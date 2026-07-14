package com.kellehs.wellness

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.util.Log
import android.widget.RemoteViews
import org.json.JSONObject
import java.net.URL
import java.text.NumberFormat
import java.time.LocalDate
import javax.net.ssl.HttpsURLConnection

class RippleWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "RippleWidget"
        private const val API = "https://app.kels.gg/api"
        private const val UID = "f2cde901-feae-443e-abed-ddf7302bb131"
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val pending = goAsync()
        Thread {
            try {
                val glucose = fetchGlucose()
                val steps = fetchSteps()
                for (id in appWidgetIds) {
                    val views = RemoteViews(context.packageName, R.layout.ripple_widget)
                    views.setTextViewText(R.id.widget_glucose, glucose)
                    views.setTextViewText(R.id.widget_steps, steps)

                    // Tap widget to force refresh
                    val refreshIntent = Intent(context, RippleWidgetProvider::class.java).apply {
                        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds)
                    }
                    val refreshPending = PendingIntent.getBroadcast(
                        context, 0, refreshIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(R.id.widget_root, refreshPending)

                    appWidgetManager.updateAppWidget(id, views)
                }
            } finally {
                pending.finish()
            }
        }.start()
    }

    private fun fetchGlucose(): String {
        return try {
            val conn = URL("$API/glucose/status?user_id=$UID").openConnection() as HttpsURLConnection
            conn.connectTimeout = 4000
            conn.readTimeout = 4000
            val text = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            val obj = JSONObject(text)
            if (obj.optBoolean("hasData", false)) {
                val mg = obj.optInt("mg_dl", 0)
                val arrow = obj.optString("arrow", "").trim()
                if (arrow.isNotEmpty()) "$mg mg/dL $arrow" else "$mg mg/dL"
            } else "-- mg/dL"
        } catch (e: Exception) {
            Log.w(TAG, "fetchGlucose failed", e)
            "-- mg/dL"
        }
    }

    private fun fetchSteps(): String {
        return try {
            val today = LocalDate.now().toString()
            val conn = URL("$API/health-connect/steps?user_id=$UID&date=$today").openConnection() as HttpsURLConnection
            conn.connectTimeout = 4000
            conn.readTimeout = 4000
            val text = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            val obj = JSONObject(text)
            val steps = obj.optInt("steps", 0)
            if (steps > 0) "${NumberFormat.getNumberInstance().format(steps)} steps" else "-- steps"
        } catch (e: Exception) {
            Log.w(TAG, "fetchSteps failed", e)
            "-- steps"
        }
    }
}
