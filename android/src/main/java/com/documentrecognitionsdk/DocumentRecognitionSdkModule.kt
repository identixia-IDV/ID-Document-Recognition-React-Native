package com.documentrecognitionsdk


import android.graphics.Bitmap
import android.graphics.Matrix
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.identixia.documentrecognitionsdk.DocumentRecognitionSDK
import java.util.concurrent.Executors


class DocumentRecognitionSdkModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {


  private val executor = Executors.newSingleThreadExecutor()


  override fun getName(): String = NAME


  @ReactMethod
  fun getMachineCode(promise: Promise) {
    executor.execute {
      try {
        promise.resolve(DocumentRecognitionSDK.getMachineCode(reactContext.applicationContext) ?: "")
      } catch (t: Throwable) {
        promise.reject("E_MACHINE_CODE", t.message, t)
      }
    }
  }


  @ReactMethod
  fun setActivation(license: String, promise: Promise) {
    executor.execute {
      try {
        val code = DocumentRecognitionSDK.setActivation(reactContext.applicationContext, license)
        promise.resolve(code)
      } catch (t: Throwable) {
        promise.reject("E_ACTIVATION", t.message, t)
      }
    }
  }


  @ReactMethod
  fun init(promise: Promise) {
    executor.execute {
      try {
        val code = DocumentRecognitionSDK.init(reactContext.applicationContext)
        promise.resolve(code)
      } catch (t: Throwable) {
        promise.reject("E_INIT", t.message, t)
      }
    }
  }


  @ReactMethod
  fun deinit(promise: Promise) {
    executor.execute {
      try {
        DocumentRecognitionSDK.deinit()
        promise.resolve(null)
      } catch (t: Throwable) {
        promise.reject("E_DEINIT", t.message, t)
      }
    }
  }


  @ReactMethod
  fun startNewSession(optionsJson: String?, promise: Promise) {
    executor.execute {
      try {
        val json = if (optionsJson.isNullOrBlank()) {
          DocumentRecognitionSDK.startNewSession()
        } else {
          DocumentRecognitionSDK.startNewSession(optionsJson)
        }
        promise.resolve(json)
      } catch (t: Throwable) {
        promise.reject("E_SESSION", t.message, t)
      }
    }
  }


  @ReactMethod
  fun locateDocument(imageUri: String, alreadyCropped: Boolean, promise: Promise) {
    executor.execute {
      try {
        val bitmap = loadBitmap(imageUri)
          ?: run {
            promise.reject("E_IMAGE", "Could not decode image: $imageUri")
            return@execute
          }
        // Live scores need uprightPortrait on the guide crop (same as pre-camera-OCR fix).
        val upright = uprightPortrait(bitmap)
        val locateBmp = scaleMax(upright, LOCATE_MAX_EDGE)
        val json = DocumentRecognitionSDK.locateDocument(locateBmp)
        promise.resolve(
          rescaleLocateJson(
            json,
            locateBmp.width,
            locateBmp.height,
            upright.width,
            upright.height
          )
        )
      } catch (t: Throwable) {
        promise.reject("E_LOCATE", t.message, t)
      }
    }
  }


  @ReactMethod
  fun recognize(
    frontUri: String,
    backUri: String?,
    authenticityMode: String,
    alreadyCropped: Boolean,
    promise: Promise
  ) {
    executor.execute {
      try {
        val frontRaw = loadBitmap(frontUri)
          ?: run {
            promise.reject("E_IMAGE", "Could not decode front image: $frontUri")
            return@execute
          }
        val front = prepareStillBitmap(frontRaw, alreadyCropped)
        val back: Bitmap? =
          if (backUri.isNullOrBlank()) {
            null
          } else {
            loadBitmap(backUri)?.let { prepareStillBitmap(it, alreadyCropped) }
          }
        DocumentRecognitionSDK.startNewSession("{\"scenario\":\"FullProcess\",\"series\":false}")
        val json = DocumentRecognitionSDK.documentRecognition(front, back, alreadyCropped)
        promise.resolve(json)
      } catch (t: Throwable) {
        promise.reject("E_RECOGNIZE", t.message, t)
      }
    }
  }


  @ReactMethod
  fun cropToGuide(
    imageUri: String,
    viewW: Double,
    viewH: Double,
    previewW: Double,
    previewH: Double,
    promise: Promise
  ) {
    executor.execute {
      try {
        val raw = loadBitmap(imageUri)
          ?: run {
            promise.reject("E_IMAGE", "Could not decode image: $imageUri")
            return@execute
          }
        val still = uprightPortrait(raw)
        val cropped = cropToGuide(
          still,
          viewW.toFloat(),
          viewH.toFloat(),
          previewW.toFloat(),
          previewH.toFloat(),
        )
          ?: run {
            promise.reject("E_CROP", "Could not crop to the camera rectangle")
            return@execute
          }
        val out = java.io.File(
          reactContext.cacheDir,
          "dr_guide_${System.currentTimeMillis()}.jpg"
        )
        java.io.FileOutputStream(out).use { stream ->
          cropped.compress(Bitmap.CompressFormat.JPEG, 92, stream)
        }
        if (cropped !== still && !cropped.isRecycled) cropped.recycle()
        promise.resolve(out.absolutePath)
      } catch (t: Throwable) {
        promise.reject("E_CROP", t.message, t)
      }
    }
  }


  @ReactMethod
  fun documentRecognition(
    frontUri: String,
    backUri: String?,
    alreadyCropped: Boolean,
    promise: Promise
  ) {
    processStill(frontUri, backUri, alreadyCropped, promise, livenessOnly = false)
  }


  @ReactMethod
  fun documentLiveness(
    frontUri: String,
    backUri: String?,
    alreadyCropped: Boolean,
    promise: Promise
  ) {
    processStill(frontUri, backUri, alreadyCropped, promise, livenessOnly = true)
  }


  private fun processStill(
    frontUri: String,
    backUri: String?,
    alreadyCropped: Boolean,
    promise: Promise,
    livenessOnly: Boolean,
  ) {
    executor.execute {
      try {
        val frontRaw = loadBitmap(frontUri)
          ?: run {
            promise.reject("E_IMAGE", "Could not decode front image: $frontUri")
            return@execute
          }
        val front = prepareStillBitmap(frontRaw, alreadyCropped)
        val back: Bitmap? =
          if (backUri.isNullOrBlank()) {
            null
          } else {
            loadBitmap(backUri)?.let { prepareStillBitmap(it, alreadyCropped) }
          }
        val scenario =
          if (livenessOnly) "{\"scenario\":\"FullAuth\",\"series\":false}"
          else "{\"scenario\":\"FullProcess\",\"series\":false}"
        DocumentRecognitionSDK.startNewSession(scenario)
        val json =
          if (livenessOnly) DocumentRecognitionSDK.documentLiveness(front, back, alreadyCropped)
          else DocumentRecognitionSDK.documentRecognition(front, back, alreadyCropped)
        promise.resolve(json)
      } catch (t: Throwable) {
        promise.reject(if (livenessOnly) "E_LIVENESS" else "E_RECOGNITION", t.message, t)
      }
    }
  }


  @ReactMethod
  fun lastLicenseError(promise: Promise) {
    try {
      promise.resolve(DocumentRecognitionSDK.lastLicenseError() ?: "")
    } catch (t: Throwable) {
      promise.reject("E_LICENSE_ERROR", t.message, t)
    }
  }


  @ReactMethod
  fun getLicenseStatus(promise: Promise) {
    try {
      promise.resolve(DocumentRecognitionSDK.getLicenseStatus() ?: "{}")
    } catch (t: Throwable) {
      promise.reject("E_LICENSE_STATUS", t.message, t)
    }
  }


  @ReactMethod
  fun writeStatus(json: String, promise: Promise) {
    try {
      val file = java.io.File(reactContext.filesDir, "docreader_status.json")
      file.writeText(json)
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("E_STATUS", t.message, t)
    }
  }


  private fun loadBitmap(uriOrBase64: String): Bitmap? {
    return if (uriOrBase64.startsWith("data:") || looksLikeBase64(uriOrBase64)) {
      ImageUtils.bitmapFromBase64(uriOrBase64)
    } else {
      ImageUtils.bitmapFromUri(reactContext.applicationContext, uriOrBase64)
    }
  }


  private fun looksLikeBase64(value: String): Boolean {
    return value.length > 256 && !value.contains("://") && !value.startsWith("/") && !value.startsWith("file:")
  }


  /**
   * Same as Flutter [cropRectForGuide]: slice JPEG to the displayed preview FOV,
   * then take the overlay as a fraction of the cover-visible region.
   */
  private fun cropToGuide(
    still: Bitmap,
    viewW: Float,
    viewH: Float,
    previewW: Float = 0f,
    previewH: Float = 0f,
  ): Bitmap? {
    if (viewW <= 1f || viewH <= 1f || still.width < 8 || still.height < 8) return null
    val imageW = still.width
    val imageH = still.height
    val (mapW, mapH) = mappingImageSize(imageW, imageH, previewW, previewH)
    val ox = (imageW - mapW) / 2f
    val oy = (imageH - mapH) / 2f
    val ratio = 85.6f / 53.98f
    var fw = viewW * 0.86f
    var fh = fw / ratio
    if (fh > viewH * 0.72f) {
      fh = viewH * 0.72f
      fw = fh * ratio
    }
    val guideLeft = (viewW - fw) / 2f
    val guideTop = (viewH - fh) / 2f
    val scale = kotlin.math.max(viewW / mapW, viewH / mapH)
    val dx = (viewW - mapW * scale) / 2f
    val dy = (viewH - mapH * scale) / 2f
    val visLeft = (0f - dx) / scale
    val visTop = (0f - dy) / scale
    val visW = viewW / scale
    val visH = viewH / scale
    val left = visLeft + visW * (guideLeft / viewW) + ox
    val top = visTop + visH * (guideTop / viewH) + oy
    val right = left + visW * (fw / viewW)
    val bottom = top + visH * (fh / viewH)
    val srcLeft = left.toInt().coerceIn(0, imageW - 1)
    val srcTop = top.toInt().coerceIn(0, imageH - 1)
    val srcRight = right.toInt().coerceIn(srcLeft + 1, imageW)
    val srcBottom = bottom.toInt().coerceIn(srcTop + 1, imageH)
    val w = srcRight - srcLeft
    val h = srcBottom - srcTop
    if (w < 32 || h < 32) return null
    return Bitmap.createBitmap(still, srcLeft, srcTop, w, h)
  }

  private fun mappingImageSize(
    imageW: Int,
    imageH: Int,
    previewW: Float,
    previewH: Float,
  ): Pair<Int, Int> {
    if (previewW <= 1f || previewH <= 1f) return imageW to imageH
    val dw = if (previewW > previewH) previewH else previewW
    val dh = if (previewW > previewH) previewW else previewH
    val displayAspect = dw / dh
    val imageAspect = imageW.toFloat() / imageH
    if (kotlin.math.abs(displayAspect - imageAspect) < 0.01f) return imageW to imageH
    return if (displayAspect > imageAspect) {
      imageW to (imageW / displayAspect).toInt().coerceAtLeast(1).coerceAtMost(imageH)
    } else {
      (imageH * displayAspect).toInt().coerceAtLeast(1).coerceAtMost(imageW) to imageH
    }
  }


  /** Camera guide crops are landscape ID-1 packs — upright when alreadyCropped is false (match native). */
  private fun prepareStillBitmap(src: Bitmap, alreadyCropped: Boolean): Bitmap {
    return if (alreadyCropped) src else uprightPortrait(src)
  }

  private fun uprightPortrait(src: Bitmap): Bitmap {
    if (src.width <= src.height) return src
    val matrix = Matrix().apply { postRotate(90f) }
    return Bitmap.createBitmap(src, 0, 0, src.width, src.height, matrix, true)
  }


  private fun scaleMax(src: Bitmap, maxEdge: Int): Bitmap {
    val longest = maxOf(src.width, src.height)
    if (longest <= maxEdge) return src
    val scale = maxEdge.toFloat() / longest
    return Bitmap.createScaledBitmap(
      src,
      (src.width * scale).toInt().coerceAtLeast(1),
      (src.height * scale).toInt().coerceAtLeast(1),
      true
    )
  }


  private fun rescaleLocateJson(
    json: String,
    locateW: Int,
    locateH: Int,
    imageW: Int,
    imageH: Int
  ): String {
    if (json.isEmpty()) return json
    return try {
      val root = org.json.JSONObject(json)
      root.put("_locateImageWidth", imageW)
      root.put("_locateImageHeight", imageH)
      val pos = root.optJSONObject("position") ?: return root.toString()
      val sx = imageW.toFloat() / locateW.coerceAtLeast(1)
      val sy = imageH.toFloat() / locateH.coerceAtLeast(1)
      val corners = pos.optJSONArray("corners")
      if (corners != null && corners.length() >= 4) {
        for (i in 0 until corners.length()) {
          val p = corners.optJSONObject(i) ?: continue
          p.put("x", p.optDouble("x") * sx)
          p.put("y", p.optDouble("y") * sy)
        }
      } else {
        if (pos.has("left")) pos.put("left", pos.optDouble("left") * sx)
        if (pos.has("top")) pos.put("top", pos.optDouble("top") * sy)
        if (pos.has("right")) pos.put("right", pos.optDouble("right") * sx)
        if (pos.has("bottom")) pos.put("bottom", pos.optDouble("bottom") * sy)
      }
      root.toString()
    } catch (_: Throwable) {
      json
    }
  }


  companion object {
    const val NAME = "DocumentRecognitionSdk"
    private const val LOCATE_MAX_EDGE = 480
  }

  @ReactMethod
  fun documentProcess(imagesJson: String, rfidJson: String?, optionsJson: String?, promise: Promise) {
    executor.execute {
      try {
        promise.resolve(
          DocumentRecognitionSDK.documentProcess(imagesJson, rfidJson ?: "", optionsJson ?: "{}")
        )
      } catch (t: Throwable) {
        promise.reject("E_DOCUMENT_PROCESS", t.message, t)
      }
    }
  }

  @ReactMethod
  fun faceLiveness(imageUri: String, mode: Int, promise: Promise) {
    val context = reactApplicationContext
    executor.execute {
      try {
        val bitmap = loadBitmap(imageUri)
          ?: run {
            promise.reject("E_IMAGE", "Could not decode portrait: $imageUri")
            return@execute
          }
        promise.resolve(DocumentRecognitionSDK.faceLiveness(bitmap, mode))
      } catch (t: Throwable) {
        promise.reject("E_FACE_LIVENESS", t.message, t)
      }
    }
  }

}
