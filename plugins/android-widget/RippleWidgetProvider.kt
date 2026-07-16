package com.kellehs.wellness

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.net.Uri
import android.util.Log
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.net.URL
import java.text.NumberFormat
import java.time.LocalDate
import javax.net.ssl.HttpsURLConnection

class RippleWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "RippleWidget"
        private const val API = "https://app.kels.gg/api"
        private const val WIDGET_AUTH_FILE = "widget_auth.json"
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val pending = goAsync()
        Thread {
            try {
                val token = readToken(context)
                val glucose = if (token != null) fetchGlucose(token) else "Sign in"
                val steps = if (token != null) fetchSteps(token) else "--"

                for (id in appWidgetIds) {
                    val views = RemoteViews(context.packageName, R.layout.ripple_widget)
                    views.setTextViewText(R.id.widget_glucose, glucose)
                    views.setTextViewText(R.id.widget_steps, steps)

                    // Tap widget root to refresh
                    val refreshIntent = Intent(context, RippleWidgetProvider::class.java).apply {
                        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds)
                    }
                    val refreshPending = PendingIntent.getBroadcast(
                        context, 0, refreshIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(R.id.widget_root, refreshPending)

                    // Water button — deep link into app
                    val waterIntent = Intent(Intent.ACTION_VIEW, Uri.parse("ripple://log-water")).apply {
                        setPackage(context.packageName)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    val waterPending = PendingIntent.getActivity(
                        context, 1, waterIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(R.id.btn_water, waterPending)

                    // Meals button — deep link into app
                    val mealsIntent = Intent(Intent.ACTION_VIEW, Uri.parse("ripple://meals")).apply {
                        setPackage(context.packageName)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    val mealsPending = PendingIntent.getActivity(
                        context, 2, mealsIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(R.id.btn_meals, mealsPending)

                    appWidgetManager.updateAppWidget(id, views)
                }
            } finally {
                pending.finish()
            }
        }.start()
    }

    private fun readToken(context: Context): String? {
        return try {
            val file = File(context.filesDir, WIDGET_AUTH_FILE)
            if (!file.exists()) return null
            val json = JSONObject(file.readText())
            json.optString("token").takeIf { it.isNotEmpty() }
        } catch (e: Exception) {
            Log.w(TAG, "readToken failed", e)
            null
        }
    }

    private fun fetchGlucose(token: String): String {
        return try {
            val conn = URL("$API/glucose/status").openConnection() as HttpsURLConnection
            conn.connectTimeout = 4000
            conn.readTimeout = 4000
            conn.setRequestProperty("Authorization", "Bearer $token")
            val text = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            val obj = JSONObject(text)
            if (obj.optBoolean("hasData", false)) {
                val mg = obj.optInt("mg_dl", 0)
                val arrow = obj.optString("arrow", "").trim()
                if (arrow.isNotEmpty()) "$mg $arrow" else "$mg mg/dL"
            } else "No data"
        } catch (e: Exception) {
            Log.w(TAG, "fetchGlucose failed", e)
            "-- mg/dL"
        }
    }

    private fun fetchSteps(token: String): String {
        return try {
            val today = LocalDate.now().toString()
            val conn = URL("$API/health-connect/steps?date=$today").openConnection() as HttpsURLConnection
            conn.connectTimeout = 4000
            conn.readTimeout = 4000
            conn.setRequestProperty("Authorization", "Bearer $token")
            val text = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            val obj = JSONObject(text)
            val steps = obj.optInt("steps", 0)
            if (steps > 0) NumberFormat.getNumberInstance().format(steps) else "--"
        } catch (e: Exception) {
            Log.w(TAG, "fetchSteps failed", e)
            "-- steps"
        }
    }
}
