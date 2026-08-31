package expo.modules.ripplewidgetsync

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RippleWidgetSyncModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RippleWidgetSync")

    // Fire-and-forget: asks RippleWidgetProvider to refetch metrics and push
    // them to any paired Wear OS device (and re-render pinned widgets).
    // Explicit broadcast by class name — no compile-time dep on the app package.
    // Guard with `if` rather than an early `return@Function`: the lambda's
    // return type infers as Any?, so a bare early return (Unit) fails to compile.
    Function("syncNow") {
      val context = appContext.reactContext
      if (context != null) {
        val intent = Intent("${context.packageName}.WIDGET_WEAR_SYNC")
          .setClassName(context.packageName, "${context.packageName}.RippleWidgetProvider")
        context.sendBroadcast(intent)
      }
    }
  }
}
