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
        private const val AUTH_FILE = "widget_auth.json"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            showPlaceholder(context, appWidgetManager, id)
            val pending = goAsync()
            Thread {
                try {
                    fetchAndUpdate(context, appWidgetManager, id)
                } finally {
                    pending.finish()
                }
            }.start()
        }
    }

    private fun showPlaceholder(context: Context, manager: AppWidgetManager, id: Int) {
        try {
            val views = buildViews(context, "--", "--")
            manager.updateAppWidget(id, views)
        } catch (e: Exception) {
            Log.e(TAG, "placeholder failed", e)
        }
    }

    private fun fetchAndUpdate(context: Context, manager: AppWidgetManager, id: Int) {
        val token = readToken(context)
        val glucose: String
        val steps: String
        if (token == null) {
            glucose = "Sign in"
            steps = "--"
        } else {
            glucose = fetchGlucose(token)
            steps = fetchSteps(token)
        }
        try {
            manager.updateAppWidget(id, buildViews(context, glucose, steps))
        } catch (e: Exception) {
            Log.e(TAG, "update error", e)
        }
    }

    private fun buildViews(context: Context, glucose: String, steps: String): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.ripple_widget)
        views.setTextViewText(R.id.widget_glucose, glucose)
        views.setTextViewText(R.id.widget_steps, steps)

        // Tap anywhere on widget → open app
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent()
        views.setOnClickPendingIntent(
            R.id.widget_root,
            PendingIntent.getActivity(context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        )

        // + Meal button → ripple://meals
        try {
            val mealIntent = Intent(Intent.ACTION_VIEW, Uri.parse("ripple://meals")).apply {
                setPackage(context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            views.setOnClickPendingIntent(
                R.id.btn_meal,
                PendingIntent.getActivity(context, 1, mealIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            )
        } catch (e: Exception) {
            Log.w(TAG, "btn_meal intent failed", e)
        }

        // + Mood button → ripple://mood
        try {
            val moodIntent = Intent(Intent.ACTION_VIEW, Uri.parse("ripple://mood")).apply {
                setPackage(context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            views.setOnClickPendingIntent(
                R.id.btn_mood,
                PendingIntent.getActivity(context, 2, moodIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            )
        } catch (e: Exception) {
            Log.w(TAG, "btn_mood intent failed", e)
        }

        return views
    }

    private fun readToken(context: Context): String? = try {
        val file = File(context.filesDir, AUTH_FILE)
        if (!file.exists()) null
        else JSONObject(file.readText()).optString("token").takeIf { it.isNotEmpty() }
    } catch (e: Exception) {
        Log.w(TAG, "readToken failed", e)
        null
    }

    private fun fetchGlucose(token: String): String = try {
        val conn = URL("$API/glucose/status").openConnection() as HttpsURLConnection
        conn.connectTimeout = 5000
        conn.readTimeout = 5000
        conn.setRequestProperty("Authorization", "Bearer $token")
        val code = conn.responseCode
        if (code == 401 || code == 403) {
            conn.disconnect()
            return "Auth err"
        }
        val obj = JSONObject(conn.inputStream.bufferedReader().readText())
        conn.disconnect()
        if (obj.optBoolean("hasData", false)) {
            val mg = obj.optInt("mg_dl", 0)
            val arrow = obj.optString("arrow", "").trim()
            if (arrow.isNotEmpty()) "$mg $arrow" else "$mg mg/dL"
        } else "--"
    } catch (e: Exception) {
        Log.w(TAG, "fetchGlucose failed", e)
        "Err"
    }

    private fun fetchSteps(token: String): String = try {
        val today = LocalDate.now().toString()
        val conn = URL("$API/health-connect/steps?date=$today").openConnection() as HttpsURLConnection
        conn.connectTimeout = 4000
        conn.readTimeout = 4000
        conn.setRequestProperty("Authorization", "Bearer $token")
        val obj = JSONObject(conn.inputStream.bufferedReader().readText())
        conn.disconnect()
        val count = obj.optInt("steps", 0)
        if (count > 0) NumberFormat.getNumberInstance().format(count) else "--"
    } catch (e: Exception) {
        Log.w(TAG, "fetchSteps failed", e)
        "--"
    }
}
