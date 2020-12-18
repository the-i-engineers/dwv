// namespaces
var dwv = dwv || {};
dwv.image = dwv.image || {};

/**
 * Create a dwv.image.View from a DICOM buffer.
 * @constructor
 */
dwv.image.DicomBufferToView = function () {
  // closure to self
  var self = this;

  // initialise the thread pool
  var pool = new dwv.utils.ThreadPool(15);

  /**
   * The default character set (optional).
   *
   * @private
   * @type {string}
   */
  var defaultCharacterSet;

  /**
   * Set the default character set.
   *
   * @param {string} characterSet The character set.
   */
  this.setDefaultCharacterSet = function (characterSet) {
    defaultCharacterSet = characterSet;
  };

  /**
   * Pixel buffer decoder.
   * Define only once to allow optional asynchronous mode.
   *
   * @private
   * @type {object}
   */
  var pixelDecoder = null;

  /**
   * Get data from an input buffer using a DICOM parser.
   *
   * @param {Array} buffer The input data buffer.
   * @param {string} origin The data origin.
   * @param {number} dataIndex The data index.
   */
  this.convert = function (buffer, origin, dataIndex) {
    self.onloadstart({
      source: origin
    });

    // DICOM parser
    pool.onerror = function(event) {
      self.onerror({
        error: event.error,
        source: origin
      });
      self.onloadend({
        source: origin
      });
    };
    pool.onworkitem = function (result) {
      var dicomElements = result.data[0];
      var origin = result.data[1];
      var dataIndex = result.data[2];
      var dicomElementsWrapped = new dwv.dicom.DicomElementsWrapper(dicomElements);
      var pixelBuffer = dicomElements.x7FE00010.value;
      var syntax = dwv.dicom.cleanString(
          dicomElements.x00020010.value[0]);
      var algoName = dwv.dicom.getSyntaxDecompressionName(syntax);
      var needDecompression = (algoName !== null);

      // generate the image and view
      var generateImageAndView = function (/*event*/) {
        // create the image
        var imageFactory = new dwv.image.ImageFactory();
        var viewFactory = new dwv.image.ViewFactory();
        try {
          var image = imageFactory.create(
              dicomElementsWrapped, pixelBuffer);
          var view = viewFactory.create(
              dicomElementsWrapped, image);
          // call onload
          self.onloaditem({
            'data': {
              'view': view,
              'info': dicomElements
            },
            source: origin
          });
        } catch (error) {
          self.onerror({
            error: error,
            source: origin
          });
          self.onloadend({
            source: origin
          });
        }
      };

      if (needDecompression) {
        // gather pixel buffer meta data
        var bitsAllocated = dicomElements.x00280100.value[0];
        var pixelRepresentation =
            dicomElements.x00280103.value[0];
        var pixelMeta = {
          'bitsAllocated': bitsAllocated,
          'isSigned': (pixelRepresentation === 1)
        };
        var columnsElement = dicomElements.x00280011;
        var rowsElement = dicomElements.x00280010;
        if (typeof columnsElement !== 'undefined' &&
            typeof rowsElement !== 'undefined') {
          pixelMeta.sliceSize = columnsElement.value[0] * rowsElement.value[0];
        }
        var samplesPerPixelElement = dicomElements.x00280002;
        if (typeof samplesPerPixelElement !== 'undefined') {
          pixelMeta.samplesPerPixel = samplesPerPixelElement.value[0];
        }
        var planarConfigurationElement =
            dicomElements.x00280006;
        if (typeof planarConfigurationElement !== 'undefined') {
          pixelMeta.planarConfiguration = planarConfigurationElement.value[0];
        }

        // number of frames
        var numberOfFrames = pixelBuffer.length;

        // decoder callback
        var countDecodedFrames = 0;
        var onDecodedFrame = function (event) {
          ++countDecodedFrames;
          // send progress
          self.onprogress({
            lengthComputable: true,
            loaded: (countDecodedFrames * 100 / numberOfFrames),
            total: 100,
            index: dataIndex,
            source: origin
          });
          // store data
          var frameNb = event.index;
          pixelBuffer[frameNb] = event.data[0];
          // create image for the first frame
          // (the viewer displays the first element of the buffer)
          if (frameNb === 0) {
            generateImageAndView();
          }
        };

        // setup the decoder (one decoder per convert)
        // TODO check if it is ok to create a worker pool per file...
        pixelDecoder = new dwv.image.PixelBufferDecoder(
            algoName, numberOfFrames);
        // callbacks
        // pixelDecoder.ondecodestart: nothing to do
        pixelDecoder.ondecodeditem = onDecodedFrame;
        pixelDecoder.ondecoded = self.onload;
        pixelDecoder.ondecodeend = self.onloadend;
        pixelDecoder.onerror = self.onerror;
        pixelDecoder.onabort = self.onabort;

        // launch decode
        for (var f = 0; f < numberOfFrames; ++f) {
          pixelDecoder.decode(pixelBuffer[f], pixelMeta, f);
        }
      } else {
        // no decompression
        // send progress
        self.onprogress({
          lengthComputable: true,
          loaded: 100,
          total: 100,
          index: dataIndex,
          source: origin
        });
        // generate image
        generateImageAndView();
        // send load events
        self.onload({
          source: origin
        });
        self.onloadend({
          source: origin
        });
      }
    };

    var workerTask = new dwv.utils.WorkerTask(
        'assets/dwv/decoders/dicom/dicomBufferToViewWorker.js',
        {buffer, origin, dataIndex, defaultCharacterSet}
    );
    // add it the queue and run it
    pool.addWorkerTask(workerTask);
  };

  /**
   * Abort a conversion.
   */
  this.abort = function () {
    // abort decoding, will trigger pixelDecoder.onabort
    if (pixelDecoder) {
      pixelDecoder.abort();
    }
  };
};

/**
 * Handle a load start event.
 * Default does nothing.
 *
 * @param {object} _event The load start event.
 */
dwv.image.DicomBufferToView.prototype.onloadstart = function (_event) {};
/**
 * Handle a load progress event.
 * Default does nothing.
 *
 * @param {object} _event The progress event.
 */
dwv.image.DicomBufferToView.prototype.onprogress = function (_event) {};
/**
 * Handle a load event.
 * Default does nothing.
 *
 * @param {object} _event The load event fired
 *   when a file has been loaded successfully.
 */
dwv.image.DicomBufferToView.prototype.onload = function (_event) {};
/**
 * Handle a load end event.
 * Default does nothing.
 *
 * @param {object} _event The load end event fired
 *  when a file load has completed, successfully or not.
 */
dwv.image.DicomBufferToView.prototype.onloadend = function (_event) {};
/**
 * Handle an error event.
 * Default does nothing.
 *
 * @param {object} _event The error event.
 */
dwv.image.DicomBufferToView.prototype.onerror = function (_event) {};
/**
 * Handle an abort event.
 * Default does nothing.
 *
 * @param {object} _event The abort event.
 */
dwv.image.DicomBufferToView.prototype.onabort = function (_event) {};
