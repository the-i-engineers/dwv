// namespaces
var dwv = dwv || {};
dwv.image = dwv.image || {};

/**
 * View class.
 *
 * @class
 * @param {Image} image The associated image.
 * Need to set the window lookup table once created
 * (either directly or with helper methods).
 */
dwv.image.View = function (image) {
  /**
   * Window lookup tables, indexed per Rescale Slope and Intercept (RSI).
   *
   * @private
   * @type {Window}
   */
  var windowLuts = {};

  /**
   * Window presets.
   * Minmax will be filled at first use (see view.setWindowLevelPreset).
   *
   * @private
   * @type {object}
   */
  var windowPresets = {'minmax': {'name': 'minmax'}};

  /**
   * Current window preset name.
   *
   * @private
   * @type {string}
   */
  var currentPresetName = null;

  /**
   * colour map.
   *
   * @private
   * @type {object}
   */
  var colourMap = dwv.image.lut.plain;
  /**
   * Current position.
   *
   * @private
   * @type {object}
   */
  var currentPosition = {'i': 0, 'j': 0, 'k': 0};
  /**
   * Current frame. Zero based.
   *
   * @private
   * @type {number}
   */
  var currentFrame = null;

  /**
   * Get the associated image.
   *
   * @returns {Image} The associated image.
   */
  this.getImage = function () {
    return image;
  };
  /**
   * Set the associated image.
   *
   * @param {Image} inImage The associated image.
   */
  this.setImage = function (inImage) {
    image = inImage;
  };

  /**
   * Get the milliseconds per frame from frame rate.
   *
   * @returns {number} The milliseconds per frame.
   */

  this.getPlaybackMilliseconds = function (recommendedDisplayFrameRate) {
    if (!recommendedDisplayFrameRate) {
      // Default to 10 FPS if none is found in the meta
      recommendedDisplayFrameRate = 10;
    }
    // round milliseconds per frame to nearest whole number
    return Math.round(1000 / recommendedDisplayFrameRate);
  };

  /**
   * Get the window LUT of the image.
   * Warning: can be undefined in no window/level was set.
   *
   * @param {object} rsi Optional image rsi, will take the one of the
   *   current slice otherwise.
   * @returns {Window} The window LUT of the image.
   * @fires dwv.image.View#wlwidthchange
   * @fires dwv.image.View#wlcenterchange
   */
  this.getCurrentWindowLut = function (rsi) {
    var sliceNumber = this.getCurrentPosition().k;
    // use current rsi if not provided
    if (typeof rsi === 'undefined') {
      rsi = image.getRescaleSlopeAndIntercept(sliceNumber);
    }
    // get the lut
    var wlut = windowLuts[rsi.toString()];

    // special case for 'perslice' presets
    if (currentPresetName &&
            typeof windowPresets[currentPresetName] !== 'undefined' &&
            typeof windowPresets[currentPresetName].perslice !== 'undefined' &&
            windowPresets[currentPresetName].perslice === true) {
      // get the preset for this slice
      var wl = windowPresets[currentPresetName].wl[sliceNumber];
      // apply it if different from previous
      if (!wlut.getWindowLevel().equals(wl)) {
        // previous values
        var previousWidth = wlut.getWindowLevel().getWidth();
        var previousCenter = wlut.getWindowLevel().getCenter();
        // set slice window level
        wlut.setWindowLevel(wl);
        // fire event
        if (previousWidth !== wl.getWidth()) {
          this.fireEvent({
            'type': 'wl-width-change',
            'wc': wl.getCenter(),
            'ww': wl.getWidth(),
            'skipGenerate': true
          });
        }
        if (previousCenter !== wl.getCenter()) {
          this.fireEvent({
            'type': 'wl-center-change',
            'wc': wl.getCenter(),
            'ww': wl.getWidth(),
            'skipGenerate': true
          });
        }
      }
    }

    // update in case of wl change
    // TODO: should not be run in a getter...
    wlut.update();

    // return
    return wlut;
  };
  /**
   * Add the window LUT to the list.
   *
   * @param {Window} wlut The window LUT of the image.
   */
  this.addWindowLut = function (wlut) {
    var rsi = wlut.getRescaleLut().getRSI();
    windowLuts[rsi.toString()] = wlut;
  };

  /**
   * Get the window presets.
   *
   * @returns {object} The window presets.
   */
  this.getWindowPresets = function () {
    return windowPresets;
  };

  /**
   * Get the window presets names.
   *
   * @returns {object} The list of window presets names.
   */
  this.getWindowPresetsNames = function () {
    return Object.keys(windowPresets);
  };

  /**
   * Set the window presets.
   *
   * @param {object} presets The window presets.
   */
  this.setWindowPresets = function (presets) {
    windowPresets = presets;
  };

  /**
   * Set the default colour map.
   *
   * @param {object} map The colour map.
   */
  this.setDefaultColourMap = function (map) {
    colourMap = map;
  };

  /**
   * Add window presets to the existing ones.
   *
   * @param {object} presets The window presets.
   * @param {number} k The slice the preset belong to.
   */
  this.addWindowPresets = function (presets, k) {
    var keys = Object.keys(presets);
    var key = null;
    for (var i = 0; i < keys.length; ++i) {
      key = keys[i];
      if (typeof windowPresets[key] !== 'undefined') {
        if (typeof windowPresets[key].perslice !== 'undefined' &&
                    windowPresets[key].perslice === true) {
          // use first new preset wl...
          windowPresets[key].wl.splice(k, 0, presets[key].wl[0]);
        } else {
          windowPresets[key] = presets[key];
        }
      } else {
        // add new
        windowPresets[key] = presets[key];
        // fire event
        /**
         * Window/level add preset event.
         *
         * @event dwv.image.View#wlpresetadd
         * @type {object}
         * @property {string} name The name of the preset.
         */
        this.fireEvent({
          'type': 'wl-preset-add',
          'name': key
        });
      }
    }
  };

  /**
   * Get the colour map of the image.
   *
   * @returns {object} The colour map of the image.
   */
  this.getColourMap = function () {
    return colourMap;
  };
  /**
   * Set the colour map of the image.
   *
   * @param {object} map The colour map of the image.
   * @fires dwv.image.View#colorchange
   */
  this.setColourMap = function (map) {
    colourMap = map;
    /**
     * Color change event.
     *
     * @event dwv.image.View#colorchange
     * @type {object}
     * @property {number} wc The new window center value.
     * @property {number} ww The new window wdth value.
     */
    this.fireEvent({
      'type': 'colour-change',
      'wc': this.getCurrentWindowLut().getWindowLevel().getCenter(),
      'ww': this.getCurrentWindowLut().getWindowLevel().getWidth()
    });
  };

  /**
   * Get the current position.
   *
   * @returns {object} The current position.
   */
  this.getCurrentPosition = function () {
    // return a clone to avoid reference problems
    return {
      'i': currentPosition.i,
      'j': currentPosition.j,
      'k': currentPosition.k
    };
  };
  /**
   * Set the current position.
   *
   * @param {object} pos The current position.
   * @param {boolean} silent If true, does not fire a slice-change event.
   * @returns {boolean} False if not in bounds
   * @fires dwv.image.View#slicechange
   * @fires dwv.image.View#positionchange
   */
  this.setCurrentPosition = function (pos, silent) {
    // default silent flag to false
    if (typeof silent === 'undefined') {
      silent = false;
    }
    // check if possible
    if (!image.getGeometry().getSize().isInBounds(pos.i, pos.j, pos.k)) {
      return false;
    }
    var oldPosition = currentPosition;
    currentPosition = pos;

    // fire a 'position-change' event
    if (image.getPhotometricInterpretation().match(/MONOCHROME/) !== null) {
      /**
       * Position change event.
       *
       * @event dwv.image.View#positionchange
       * @type {object}
       * @property {number} i The new column position
       * @property {number} j The new row position
       * @property {number} k The new slice position
       * @property {object} value The image value at the new position.
       */
      this.fireEvent({
        'type': 'position-change',
        'i': pos.i,
        'j': pos.j,
        'k': pos.k,
        'value': image.getRescaledValue(
          pos.i, pos.j, pos.k, this.getCurrentFrame())
      });
    } else {
      this.fireEvent({
        'type': 'position-change',
        'i': pos.i,
        'j': pos.j,
        'k': pos.k
      });
    }

    // fire a slice change event (used to trigger redraw)
    if (!silent) {
      if (oldPosition.k !== currentPosition.k) {
        /**
         * Slice change event.
         *
         * @event dwv.image.View#slicechange
         * @type {object}
         * @property {number} value The new slice number
         * @property {object} data Associated event data: the imageUid.
         */
        this.fireEvent({
          'type': 'slice-change',
          'value': currentPosition.k,
          'data': {
            'imageUid': image.getImageUids()[currentPosition.k]
          }
        });
      }
    }

    // all good
    return true;
  };

  /**
   * Get the current frame number.
   *
   * @returns {number} The current frame number.
   */
  this.getCurrentFrame = function () {
    return currentFrame;
  };

  /**
   * Set the current frame number.
   *
   * @param {number} frame The current frame number.
   * @returns {boolean} False if not in bounds
   * @fires dwv.image.View#framechange
   */
  this.setCurrentFrame = function (frame) {
    // check if possible
    if (frame < 0 || frame >= image.getNumberOfFrames()) {
      return false;
    }
    // assign
    var oldFrame = currentFrame;
    currentFrame = frame;
    // fire event
    if (oldFrame !== currentFrame && image.getNumberOfFrames() !== 1) {
      /**
       * Frame change event.
       *
       * @event dwv.image.View#framechange
       * @type {object}
       * @property {number} frame The new frame number
       */
      this.fireEvent({
        'type': 'frame-change',
        'frame': currentFrame
      });
      // silent set current position to update info text
      this.setCurrentPosition(this.getCurrentPosition(), true);
    }
    // all good
    return true;
  };

  /**
   * Append another view to this one.
   *
   * @param {object} rhs The view to append.
   */
  this.append = function (rhs) {
    // append images
    var newSliceNumber = this.getImage().appendSlice(rhs.getImage());
    // update position if a slice was appended before
    if (newSliceNumber <= this.getCurrentPosition().k) {
      this.setCurrentPosition(
        {'i': this.getCurrentPosition().i,
          'j': this.getCurrentPosition().j,
          'k': this.getCurrentPosition().k + 1}, true);
    }
    // add window presets
    this.addWindowPresets(rhs.getWindowPresets(), newSliceNumber);
  };

  /**
   * Append a frame buffer to the included image.
   *
   * @param {object} frameBuffer The frame buffer to append.
   */
  this.appendFrameBuffer = function (frameBuffer) {
    this.getImage().appendFrameBuffer(frameBuffer);
  };

  /**
   * Set the view window/level.
   *
   * @param {number} center The window center.
   * @param {number} width The window width.
   * @param {string} name Associated preset name, defaults to 'manual'.
   * Warning: uses the latest set rescale LUT or the default linear one.
   * @fires dwv.image.View#wlwidthchange
   * @fires dwv.image.View#wlcenterchange
   */
  this.setWindowLevel = function (center, width, name) {
    // window width shall be >= 1 (see https://www.dabsoft.ch/dicom/3/C.11.2.1.2/)
    if (width >= 1) {

      // get current window/level (before updating name)
      var sliceNumber = this.getCurrentPosition().k;
      var currentWl = null;
      var rsi = image.getRescaleSlopeAndIntercept(sliceNumber);
      if (rsi && typeof rsi !== 'undefined') {
        var currentLut = windowLuts[rsi.toString()];
        if (currentLut && typeof currentLut !== 'undefined') {
          currentWl = currentLut.getWindowLevel();
        }
      }

      if (typeof name === 'undefined') {
        name = 'manual';
      }
      // update current preset name
      currentPresetName = name;

      var wl = new dwv.image.WindowLevel(center, width);
      var keys = Object.keys(windowLuts);

      // create the first lut if none exists
      if (keys.length === 0) {
        // create the rescale lookup table
        var rescaleLut = new dwv.image.RescaleLut(
          image.getRescaleSlopeAndIntercept(0), image.getMeta().BitsStored);
        // create the window lookup table
        var windowLut = new dwv.image.WindowLut(
          rescaleLut, image.getMeta().IsSigned);
        this.addWindowLut(windowLut);
      }

      // set window level on luts
      for (var key in windowLuts) {
        windowLuts[key].setWindowLevel(wl);
      }

      // fire window level change event
      if (currentWl && typeof currentWl !== 'undefined') {
        if (currentWl.getWidth() !== width) {
          /**
           * Window/level width change event.
           *
           * @event dwv.image.View#wlwidthchange
           * @type {object}
           * @property {number} wc The new window center value.
           * @property {number} ww The new window wdth value.
           * @property {boolean} skipGenerate Flag to skip view generation.
           */
          this.fireEvent({
            'type': 'wl-width-change',
            'wc': center,
            'ww': width
          });
        }
        if (currentWl.getCenter() !== center) {
          /**
           * Window/level center change event.
           *
           * @event dwv.image.View#wlcenterchange
           * @type {object}
           * @property {number} wc The new window center value.
           * @property {number} ww The new window wdth value.
           * @property {boolean} skipGenerate Flag to skip view generation.
           */
          this.fireEvent({
            'type': 'wl-center-change',
            'wc': center,
            'ww': width
          });
        }
      } else {
        this.fireEvent({
          'type': 'wl-width-change',
          'wc': center,
          'ww': width
        });
        this.fireEvent({
          'type': 'wl-center-change',
          'wc': center,
          'ww': width
        });
      }
    }
  };

  /**
   * Set the window level to the preset with the input name.
   *
   * @param {string} name The name of the preset to activate.
   */
  this.setWindowLevelPreset = function (name) {
    var preset = this.getWindowPresets()[name];
    if (typeof preset === 'undefined') {
      throw new Error('Unknown window level preset: \'' + name + '\'');
    }
    // special min/max
    if (name === 'minmax' && typeof preset.wl === 'undefined') {
      preset.wl = this.getWindowLevelMinMax();
    }
    // special 'perslice' case
    if (typeof preset.perslice !== 'undefined' &&
            preset.perslice === true) {
      preset = {'wl': preset.wl[this.getCurrentPosition().k]};
    }
    // set w/l
    this.setWindowLevel(preset.wl.getCenter(), preset.wl.getWidth(), name);
  };

  /**
   * Set the window level to the preset with the input id.
   *
   * @param {number} id The id of the preset to activate.
   */
  this.setWindowLevelPresetById = function (id) {
    var keys = Object.keys(this.getWindowPresets());
    this.setWindowLevelPreset(keys[id]);
  };

  /**
   * Clone the image using all meta data and the original data buffer.
   *
   * @returns {dwv.image.View} A full copy of this {dwv.image.View}.
   */
  this.clone = function () {
    var copy = new dwv.image.View(this.getImage());
    for (var key in windowLuts) {
      copy.addWindowLut(windowLuts[key]);
    }
    copy.setListeners(this.getListeners());
    return copy;
  };

  /**
   * View listeners
   *
   * @private
   * @type {object}
   */
  var listeners = {};
  /**
   * Get the view listeners.
   *
   * @returns {object} The view listeners.
   */
  this.getListeners = function () {
    return listeners;
  };
  /**
   * Set the view listeners.
   *
   * @param {object} list The view listeners.
   */
  this.setListeners = function (list) {
    listeners = list;
  };
};

/**
 * Get the image window/level that covers the full data range.
 * Warning: uses the latest set rescale LUT or the default linear one.
 *
 * @returns {object} A min/max window level.
 */
dwv.image.View.prototype.getWindowLevelMinMax = function () {
  var range = this.getImage().getRescaledDataRange();
  var min = range.min;
  var max = range.max;
  var width = max - min;
  // full black / white images, defaults to 1.
  if (width < 1) {
    console.warn('Zero or negative width, defaulting to one.');
    width = 1;
  }
  var center = min + width / 2;
  return new dwv.image.WindowLevel(center, width);
};

/**
 * Set the image window/level to cover the full data range.
 * Warning: uses the latest set rescale LUT or the default linear one.
 */
dwv.image.View.prototype.setWindowLevelMinMax = function () {
  // calculate center and width
  var wl = this.getWindowLevelMinMax();
  // set window level
  this.setWindowLevel(wl.getCenter(), wl.getWidth(), 'minmax');
};

/**
 * Generate display image data to be given to a canvas.
 *
 * @param {Array} array The array to fill in.
 */
dwv.image.View.prototype.generateImageData = function( array )
{
    var windowLut = this.getCurrentWindowLut();

    var image = this.getImage();
    var sliceSize = image.getGeometry().getSize().getSliceSize();
    var sliceOffset = sliceSize * this.getCurrentPosition().k;
    var frameOrSliceIndex = (this.getCurrentFrame()) ? this.getCurrentFrame() : this.getCurrentPosition().k;

    var index = 0;
    var pxValue = 0;
    var stepPos = 0;
    var colourMap = null;
    var frameBuffer;
    var arrayBuffer;

    var photoInterpretation = image.getPhotometricInterpretation();
    switch (photoInterpretation)
    {
    case "MONOCHROME1":
    case "MONOCHROME2":
        colourMap = this.getColourMap();
        frameBuffer = image.getFrame(frameOrSliceIndex);
        arrayBuffer = new Uint32Array(array.data.buffer);
        for(var i=0; i < sliceSize; ++i)
        {
            pxValue = windowLut.getValue(frameBuffer[i]);
            arrayBuffer[index] = 0xff000000 |
                (colourMap.blue[pxValue] << 16) |
                (colourMap.green[pxValue] << 8) |
                colourMap.red[pxValue];
            index += 1;
        }
        break;

    case "PALETTE COLOR":
        colourMap = this.getColourMap();
        var lMax = sliceOffset + sliceSize;

        var to8 = function (value) {
            return value >> 8;
        };

        if (image.getMeta().BitsStored === 16) {
            console.log("Scaling 16bits data to 8bits.");
        }

        for (var l = sliceOffset; l < lMax; ++l)
        {
            pxValue = image.getValueAtOffset(l, frame);

            // TODO check pxValue fits in lut

            if (image.getMeta().BitsStored === 16) {
                array.data[index] = to8(colourMap.red[pxValue]);
                array.data[index+1] = to8(colourMap.green[pxValue]);
                array.data[index+2] = to8(colourMap.blue[pxValue]);
            } else {
                array.data[index] = colourMap.red[pxValue];
                array.data[index+1] = colourMap.green[pxValue];
                array.data[index+2] = colourMap.blue[pxValue];
            }
            array.data[index+3] = 0xff;
            index += 4;
        }
        break;

    case "RGB":
        // the planar configuration defines the memory layout
        var planarConfig = image.getPlanarConfiguration();
        if( planarConfig !== 0 && planarConfig !== 1 ) {
            throw new Error("Unsupported planar configuration: "+planarConfig);
        }
        // default: RGBRGBRGBRGB...
        var posR = 0;
        var posG = 1;
        var posB = 2;
        stepPos = 3;
        // RRRR...GGGG...BBBB...
        if (planarConfig === 1) {
            posR = 0;
            posG = sliceSize;
            posB = 2 * sliceSize;
            stepPos = 1;
        }

        frameBuffer = image.getFrame(frameOrSliceIndex);
        arrayBuffer = new Uint32Array(array.data.buffer);

        for(var j=0; j < sliceSize; ++j)
        {
            arrayBuffer[index] = 0xff000000 |
                (windowLut.getValue(frameBuffer[posB]) << 16) |
                (windowLut.getValue(frameBuffer[posG]) << 8) |
                windowLut.getValue(frameBuffer[posR])  ;
            index += 1;

            posR += stepPos;
            posG += stepPos;
            posB += stepPos;
        }
        break;

    case "YBR_FULL":
        // theory:
        // http://dicom.nema.org/dicom/2013/output/chtml/part03/sect_C.7.html#sect_C.7.6.3.1.2
        // reverse equation:
        // https://en.wikipedia.org/wiki/YCbCr#JPEG_conversion


        // the planar configuration defines the memory layout
        var planarConfigYBR = image.getPlanarConfiguration();
        if( planarConfigYBR !== 0 && planarConfigYBR !== 1 ) {
            throw new Error("Unsupported planar configuration: "+planarConfigYBR);
        }
        // default: YBRYBRYBR...
        var posY = 0;
        var posCB = 1;
        var posCR = 2;
        stepPos = 3;
        // YYYY...BBBB...RRRR...
        if (planarConfigYBR === 1) {
            posY = 0;
            posCB = sliceSize;
            posCR = 2 * sliceSize;
            stepPos = 1;
        }

        var y, cb, cr;
        var r, g, b;
        frameBuffer = image.getFrame(frameOrSliceIndex);
        arrayBuffer = new Uint32Array(array.data.buffer);
        for (var k=0; k < sliceSize; ++k)
        {
            y = frameBuffer[posY];
            cb = frameBuffer[posCB];
            cr = frameBuffer[posCR];

            r = y + 1.402 * (cr - 128);
            g = y - 0.34414 * (cb - 128) - 0.71414 * (cr - 128);
            b = y + 1.772 * (cb - 128);

            arrayBuffer[index] = 0xff000000 |
                (windowLut.getValue(b) << 16) |
                (windowLut.getValue(g) << 8) |
                windowLut.getValue(r)  ;
            index += 4;

            posY += stepPos;
            posCB += stepPos;
            posCR += stepPos;
        }
        break;

    default:
        throw new Error("Unsupported photometric interpretation: "+photoInterpretation);
    }
};

/**
 * Add an event listener on the view.
 *
 * @param {string} type The event type.
 * @param {object} listener The method associated with the provided event type.
 */
dwv.image.View.prototype.addEventListener = function (type, listener) {
  var listeners = this.getListeners();
  if (!listeners[type]) {
    listeners[type] = [];
  }
  listeners[type].push(listener);
};

/**
 * Remove an event listener on the view.
 *
 * @param {string} type The event type.
 * @param {object} listener The method associated with the provided event type.
 */
dwv.image.View.prototype.removeEventListener = function (type, listener) {
  var listeners = this.getListeners();
  if (!listeners[type]) {
    return;
  }
  for (var i = 0; i < listeners[type].length; ++i) {
    if (listeners[type][i] === listener) {
      listeners[type].splice(i, 1);
    }
  }
};

/**
 * Fire an event: call all associated listeners.
 *
 * @param {object} event The event to fire.
 */
dwv.image.View.prototype.fireEvent = function (event) {
  var listeners = this.getListeners();
  if (!listeners[event.type]) {
    return;
  }
  for (var i = 0; i < listeners[event.type].length; ++i) {
    listeners[event.type][i](event);
  }
};
