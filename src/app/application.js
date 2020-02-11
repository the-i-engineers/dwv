/** @namespace */
var dwv = dwv || {};

/**
 * Main application class.
 * @constructor
 */
dwv.App = function ()
{
    // Local object
    var self = this;

    // Image
    var image = null;
    // Original image
    var originalImage = null;
    // Image data array
    var imageData = null;
    // Image data width
    var dataWidth = 0;
    // Image data height
    var dataHeight = 0;

    // Container div id
    var containerDivId = null;
    // Display window scale
    var windowScale = 1;
    // main scale
    var scale = 1;
    // zoom center
    var scaleCenter = {"x": 0, "y": 0};
    // translation
    var translation = {"x": 0, "y": 0};

    // View
    var view = null;
    // View controller
    var viewController = null;

    // meta data
    var metaData = null;

    // Image layer
    var imageLayer = null;

    // Draw controller
    var drawController = null;

    // Generic style
    var style = new dwv.html.Style();

    // Toolbox controller
    var toolboxController = null;

    // load controller
    var loadController = null;

    // UndoStack
    var undoStack = null;

    // listeners
    var listeners = {};

    /**
     * Get the image.
     * @return {Image} The associated image.
     */
    this.getImage = function () { return image; };
    /**
     * Set the view.
     * @param {Image} img The associated image.
     */
    this.setImage = function (img)
    {
        image = img;
        view.setImage(img);
    };
    /**
     * Restore the original image.
     */
    this.restoreOriginalImage = function ()
    {
        image = originalImage;
        view.setImage(originalImage);
    };
    /**
     * Get the image data array.
     * @return {Array} The image data array.
     */
    this.getImageData = function () { return imageData; };
    /**
     * Is the data mono-slice?
     * @return {Boolean} True if the data only contains one slice.
     */
    this.isMonoSliceData = function () {
         return loadController.isMonoSliceData();
    };
    /**
     * Is the data mono-frame?
     * @return {Boolean} True if the data only contains one frame.
     */
    this.isMonoFrameData = function () {
        return (this.getImage() && typeof this.getImage() !== "undefined" &&
            this.getImage().getNumberOfFrames() === 1);
    };
    /**
     * Can the data be scrolled?
     * @return {Boolean} True if the data has more than one slice or frame.
     */
    this.canScroll = function () {
        return !this.isMonoSliceData() || !this.isMonoFrameData();
    };

    /**
     * Can window and level be applied to the data?
     * @return {Boolean} True if the data is monochrome.
     */
    this.canWindowLevel = function () {
        return this.getImage().getPhotometricInterpretation().match(/MONOCHROME/) !== null;
    };

    /**
     * Get the main scale.
     * @return {Number} The main scale.
     */
    this.getScale = function () { return scale / windowScale; };

    /**
     * Get the window scale.
     * @return {Number} The window scale.
     */
    this.getWindowScale = function () { return windowScale; };

    /**
     * Get the scale center.
     * @return {Object} The coordinates of the scale center.
     */
    this.getScaleCenter = function () { return scaleCenter; };

    /**
     * Get the translation.
     * @return {Object} The translation.
     */
    this.getTranslation = function () { return translation; };

    /**
     * Get the view controller.
     * @return {Object} The controller.
     */
    this.getViewController = function () { return viewController; };

    /**
     * Get the toolbox controller.
     * @return {Object} The controller.
     */
    this.getToolboxController = function () { return toolboxController; };

    /**
     * Get the draw controller.
     * @return {Object} The controller.
     */
    this.getDrawController = function () { return drawController; };

    /**
     * Get the image layer.
     * @return {Object} The image layer.
     */
    this.getImageLayer = function () { return imageLayer; };

    /**
     * Get the draw stage.
     * @return {Object} The draw stage.
     */
    this.getDrawStage = function () {
        return drawController.getDrawStage();
     };

    /**
     * Get the app style.
     * @return {Object} The app style.
     */
    this.getStyle = function () { return style; };

    /**
     * Add a command to the undo stack.
     * @param {Object} cmd The command to add.
     * @fires dwv.tool.UndoStack#undo-add
     */
    this.addToUndoStack = function (cmd) {
        if ( undoStack !== null ) {
            undoStack.add(cmd);
        }
    };

    /**
     * Initialise the application.
     */
    this.init = function ( config ) {
        containerDivId = config.containerDivId;
        // undo stack
        undoStack = new dwv.tool.UndoStack();
        undoStack.addEventListener("undo-add", fireEvent);
        undoStack.addEventListener("undo", fireEvent);
        undoStack.addEventListener("redo", fireEvent);
        // tools
        if ( config.tools && config.tools.length !== 0 ) {
            // setup the tool list
            var toolList = {};
            var keys = Object.keys(config.tools);
            for ( var t = 0; t < keys.length; ++t ) {
                var toolName = keys[t];
                var toolParams = config.tools[toolName];
                // find the tool in the dwv.tool namespace
                if (typeof dwv.tool[toolName] !== "undefined") {
                    // create tool instance
                    toolList[toolName] = new dwv.tool[toolName](this);
                    // register listeners
                    if (typeof toolList[toolName].addEventListener !== "undefined") {
                        if (typeof toolParams.events !== "undefined") {
                            for (var j = 0; j < toolParams.events.length; ++j) {
                                var eventName = toolParams.events[j];
                                toolList[toolName].addEventListener(eventName, fireEvent);
                            }
                        }
                    }
                    // tool options
                    if (typeof toolParams.options !== "undefined") {
                        var type = "raw";
                        if (typeof toolParams.type !== "undefined") {
                            type = toolParams.type;
                        }
                        var options = toolParams.options;
                        if (type === "instance" ||
                            type === "factory") {
                            options = {};
                            for (var i = 0; i < toolParams.options.length; ++i) {
                                var optionName = toolParams.options[i];
                                var optionClassName = optionName;
                                if (type === "factory") {
                                    optionClassName += "Factory";
                                }
                                var toolNamespace = toolName.charAt(0).toLowerCase() + toolName.slice(1);
                                if (typeof dwv.tool[toolNamespace][optionClassName] !== "undefined") {
                                    options[optionName] = dwv.tool[toolNamespace][optionClassName];
                                } else {
                                    console.warn("Could not find option class for: " + optionName);
                                }
                            }
                        }
                        toolList[toolName].setOptions(options);
                    }
                } else {
                    console.warn("Could not initialise unknown tool: " + toolName);
                }
            }
            // add tools to the controller
            toolboxController = new dwv.ToolboxController(toolList);
        }

        // create load controller
        loadController = new dwv.LoadController(config.defaultCharacterSet);
        loadController.onloadstart = onloadstart;
        loadController.onprogress = onprogress;
        loadController.onloaditem = onloaditem;
        loadController.onload = onload;
        loadController.onloadend = onloadend;
        loadController.onerror = onerror;
        loadController.onabort = onabort;

        // listen to window resize
        window.onresize = onResize;
    };

    /**
     * Get the size of the layer container div.
     * @return {Object} The width and height of the div.
     */
    this.getLayerContainerSize = function () {
      var ldiv = self.getElement("layerContainer");
      var div = ldiv.parentNode;
      // remove the height of other elements of the container div
      var height = div.offsetHeight;
      var kids = div.children;
      for (var i = 0; i < kids.length; ++i) {
        if (kids[i].className !== "layerContainer") {
          var styles = window.getComputedStyle(kids[i]);
          var margin = parseFloat(styles.getPropertyValue('margin-top'), 10) +
               parseFloat(styles.getPropertyValue('margin-bottom'), 10);
          height -= (kids[i].offsetHeight + margin);
        }
      }
      return { 'width': div.offsetWidth, 'height': height };
    };

    /**
     * Get a HTML element associated to the application.
     * @param name The name or id to find.
     * @return The found element or null.
     */
     this.getElement = function (name)
     {
         return dwv.gui.getElement(containerDivId, name);
     };

    /**
     * Reset the application.
     */
    this.reset = function ()
    {
        // clear draw
        if ( drawController ) {
            drawController.reset();
        }
        // clear objects
        image = null;
        view = null;
        metaData = null;
        // reset undo/redo
        if ( undoStack ) {
            undoStack = new dwv.tool.UndoStack();
            undoStack.addEventListener("undo-add", fireEvent);
            undoStack.addEventListener("undo", fireEvent);
            undoStack.addEventListener("redo", fireEvent);
        }
    };

    /**
     * Reset the layout of the application.
     * @fires dwv.App#zoom-change
     * @fires dwv.App#offset-change
     */
    this.resetLayout = function () {
        var previousScale = scale;
        var previousSC = scaleCenter;
        var previousTrans = translation;
        // reset values
        scale = windowScale;
        scaleCenter = {"x": 0, "y": 0};
        translation = {"x": 0, "y": 0};
        // apply new values
        if ( imageLayer ) {
            imageLayer.resetLayout(windowScale);
            imageLayer.draw();
        }
        if ( drawController ) {
            drawController.resetStage(windowScale);
        }
        // fire events
        if (previousScale != scale) {
            fireEvent({
                "type": "zoom-change",
                "scale": scale,
                "cx": scaleCenter.x,
                "cy": scaleCenter.y
            });
        }
        if ( (previousSC.x !== scaleCenter.x || previousSC.y !== scaleCenter.y) ||
             (previousTrans.x !== translation.x || previousTrans.y !== translation.y)) {
            fireEvent({
                "type": "offset-change",
                "scale": scale,
                "cx": scaleCenter.x,
                "cy": scaleCenter.y
            });
        }
    };

    /**
     * Add an event listener on the app.
     * @param {String} type The event type.
     * @param {Object} listener The method associated with the provided event type.
     */
    this.addEventListener = function (type, listener)
    {
        if ( typeof listeners[type] === "undefined" ) {
            listeners[type] = [];
        }
        listeners[type].push(listener);
    };

    /**
     * Remove an event listener from the app.
     * @param {String} type The event type.
     * @param {Object} listener The method associated with the provided event type.
     */
    this.removeEventListener = function (type, listener)
    {
        if( typeof listeners[type] === "undefined" ) {
            return;
        }
        for ( var i = 0; i < listeners[type].length; ++i )
        {
            if ( listeners[type][i] === listener ) {
                listeners[type].splice(i,1);
            }
        }
    };

    // load API [begin] -------------------------------------------------------

    /**
     * Load a list of files. Can be image files or a state file.
     * @param {Array} files The list of files to load.
     * @fires dwv.LoadController#load-start
     * @fires dwv.LoadController#load-item-start
     * @fires dwv.LoadController#load-slice
     * @fires dwv.LoadController#load-progress
     * @fires dwv.LoadController#load-end
     * @fires dwv.LoadController#load-error
     * @fires dwv.LoadController#load-abort
     */
    this.loadFiles = function (files) {
        loadController.loadFiles(files);
    };

    /**
     * Load a list of URLs. Can be image files or a state file.
     * @param {Array} urls The list of urls to load.
     * @param {Array} requestHeaders An array of {name, value} to use as request headers.
     * @fires dwv.LoadController#load-start
     * @fires dwv.LoadController#load-item-start
     * @fires dwv.LoadController#load-slice
     * @fires dwv.LoadController#load-progress
     * @fires dwv.LoadController#load-end
     * @fires dwv.LoadController#load-error
     * @fires dwv.LoadController#load-abort
     */
    this.loadURLs = function (urls, requestHeaders) {
        loadController.loadURLs(urls, requestHeaders);
    };

    /**
     * Load a list of ArrayBuffers.
     * @param {Array} data The list of ArrayBuffers to load
     *   in the form of [{name: "", filename: "", data: data}].
     * @fires dwv.LoadController#load-start
     * @fires dwv.LoadController#load-item-start
     * @fires dwv.LoadController#load-slice
     * @fires dwv.LoadController#load-progress
     * @fires dwv.LoadController#load-end
     * @fires dwv.LoadController#load-error
     * @fires dwv.LoadController#load-abort
     */
    this.loadImageObject = function (data) {
        loadController.loadImageObject(data);
    };

    /**
     * Abort the current load.
     */
    this.abortLoad = function () {
        loadController.abort();
    };

    // load API [end] ---------------------------------------------------------

    /**
     * Fit the display to the given size. To be called once the image is loaded.
     */
    this.fitToSize = function (size)
    {
        // previous width
        var oldWidth = parseInt(windowScale*dataWidth, 10);
        // find new best fit
        windowScale = Math.min( (size.width / dataWidth), (size.height / dataHeight) );
        // new sizes
        var newWidth = parseInt(windowScale*dataWidth, 10);
        var newHeight = parseInt(windowScale*dataHeight, 10);
        // ratio previous/new to add to zoom
        var mul = newWidth / oldWidth;
        scale *= mul;

        // update style
        style.setScale(windowScale);

        // resize container
        var container = this.getElement("layerContainer");
        container.setAttribute("style","width:"+newWidth+"px;height:"+newHeight+"px");
        // resize image layer
        if ( imageLayer ) {
            imageLayer.setWidth(newWidth);
            imageLayer.setHeight(newHeight);
            imageLayer.zoom(scale, scale, 0, 0);
            imageLayer.draw();
        }
        // resize draw stage
        if ( drawController ) {
            drawController.resizeStage(newWidth, newHeight, scale);
        }
    };

    /**
     * Init the Window/Level display
     */
    this.initWLDisplay = function ()
    {
        // set window/level to first preset
        viewController.setWindowLevelPresetById(0);
        // default position
        viewController.setCurrentPosition2D(0,0);
        // default frame
        viewController.setCurrentFrame(0);
    };

    /**
     * Add canvas mouse and touch listeners.
     * @param {Object} canvas The canvas to listen to.
     */
    this.addToolCanvasListeners = function (layer)
    {
        toolboxController.addCanvasListeners(layer);
    };

    /**
     * Remove layer mouse and touch listeners.
     * @param {Object} canvas The canvas to stop listening to.
     */
    this.removeToolCanvasListeners = function (layer)
    {
        toolboxController.removeCanvasListeners(layer);
    };

    /**
     * Render the current image.
     */
    this.render = function ()
    {
        generateAndDrawImage();
    };

    /**
     * Zoom to the layers.
     * @param {Number} zoom The zoom to apply.
     * @param {Number} cx The zoom center X coordinate.
     * @param {Number} cy The zoom center Y coordinate.
     */
    this.zoom = function (zoom, cx, cy) {
        scale = zoom * windowScale;
        if ( scale <= 0.1 ) {
            scale = 0.1;
        }
        scaleCenter = {"x": cx, "y": cy};
        zoomLayers();
    };

    /**
     * Add a step to the layers zoom.
     * @param {Number} step The zoom step increment. A good step is of 0.1.
     * @param {Number} cx The zoom center X coordinate.
     * @param {Number} cy The zoom center Y coordinate.
     */
    this.stepZoom = function (step, cx, cy) {
        scale += step;
        if ( scale <= 0.1 ) {
            scale = 0.1;
        }
        scaleCenter = {"x": cx, "y": cy};
        zoomLayers();
    };

    /**
     * Apply a translation to the layers.
     * @param {Number} tx The translation along X.
     * @param {Number} ty The translation along Y.
     */
    this.translate = function (tx, ty)
    {
        translation = {"x": tx, "y": ty};
        translateLayers();
    };

    /**
     * Add a translation to the layers.
     * @param {Number} tx The step translation along X.
     * @param {Number} ty The step translation along Y.
     */
    this.stepTranslate = function (tx, ty)
    {
        var txx = translation.x + tx / scale;
        var tyy = translation.y + ty / scale;
        translation = {"x": txx, "y": tyy};
        translateLayers();
    };

    /**
     * Get the list of drawing display details.
     * @return {Object} The list of draw details including id, slice, frame...
     */
    this.getDrawDisplayDetails = function ()
    {
        return drawController.getDrawDisplayDetails();
    };

    /**
     * Get the meta data.
     * @return {Object} The list of meta data.
     */
    this.getMetaData = function ()
    {
        return metaData;
    };

    /**
     * Get a list of drawing store details.
     * @return {Object} A list of draw details including id, text, quant...
     */
    this.getDrawStoreDetails = function ()
    {
        return drawController.getDrawStoreDetails();
    };
    /**
     * Set the drawings on the current stage.
     * @param {Array} drawings An array of drawings.
     * @param {Array} drawingsDetails An array of drawings details.
     */
    this.setDrawings = function (drawings, drawingsDetails)
    {
        drawController.setDrawings(drawings, drawingsDetails, fireEvent, this.addToUndoStack);
        drawController.activateDrawLayer(viewController);
    };
    /**
     * Update a drawing from its details.
     * @param {Object} drawDetails Details of the drawing to update.
     */
    this.updateDraw = function (drawDetails)
    {
        drawController.updateDraw(drawDetails);
    };
    /**
     * Delete all Draws from all layers.
    */
    this.deleteDraws = function () {
        drawController.deleteDraws(fireEvent, this.addToUndoStack);
    };
    /**
     * Check the visibility of a given group.
     * @param {Object} drawDetails Details of the drawing to check.
     */
    this.isGroupVisible = function (drawDetails)
    {
        return drawController.isGroupVisible(drawDetails);
    };
    /**
     * Toggle group visibility.
     * @param {Object} drawDetails Details of the drawing to update.
     */
    this.toogleGroupVisibility = function (drawDetails)
    {
        drawController.toogleGroupVisibility(drawDetails);
    };

    /**
     * Get the JSON state of the app.
     * @return {Object} The state of the app as a JSON object.
     */
    this.getState = function ()
    {
        var state = new dwv.State();
        return state.toJSON(self);
    };

    // Handler Methods -----------------------------------------------------------

    /**
     * Handle window/level change.
     * @param {Object} event The event fired when changing the window/level.
     * @private
     */
    function onWLChange(event)
    {
        // generate and draw if no skip flag
        if (typeof event.skipGenerate === "undefined" ||
            event.skipGenerate === false) {
            generateAndDrawImage();
        }
    }

    /**
     * Handle colour map change.
     * @param {Object} event The event fired when changing the colour map.
     * @private
     */
    function onColourChange(/*event*/)
    {
        generateAndDrawImage();
    }

    /**
     * Handle frame change.
     * @param {Object} event The event fired when changing the frame.
     * @private
     */
    function onFrameChange(/*event*/)
    {
        generateAndDrawImage();
        if ( drawController ) {
            drawController.activateDrawLayer(viewController);
        }
    }

    /**
     * Handle slice change.
     * @param {Object} event The event fired when changing the slice.
     * @private
     */
    function onSliceChange(/*event*/)
    {
        generateAndDrawImage();
        if ( drawController ) {
            drawController.activateDrawLayer(viewController);
        }
    }

    /**
     * Handle resize.
     * Fit the display to the window. To be called once the image is loaded.
     * @param {Object} event The change event.
     * @private
     */
    function onResize (/*event*/) {
        self.fitToSize(self.getLayerContainerSize());
    }

    /**
     * Handle key down event.
     * - CRTL-Z: undo
     * - CRTL-Y: redo
     * - CRTL-ARROW_LEFT: next frame
     * - CRTL-ARROW_UP: next slice
     * - CRTL-ARROW_RIGHT: previous frame
     * - CRTL-ARROW_DOWN: previous slice
     * Default behavior. Usually used in tools.
     * @param {Object} event The key down event.
     * @fires dwv.tool.UndoStack#undo
     * @fires dwv.tool.UndoStack#redo
     */
    this.onKeydown = function (event)
    {
        if (event.ctrlKey) {
            if ( event.keyCode === 37 ) // crtl-arrow-left
            {
                event.preventDefault();
                self.getViewController().decrementFrameNb();
            }
            else if ( event.keyCode === 38 ) // crtl-arrow-up
            {
                event.preventDefault();
                self.getViewController().incrementSliceNb();
            }
            else if ( event.keyCode === 39 ) // crtl-arrow-right
            {
                event.preventDefault();
                self.getViewController().incrementFrameNb();
            }
            else if ( event.keyCode === 40 ) // crtl-arrow-down
            {
                event.preventDefault();
                self.getViewController().decrementSliceNb();
            }
            else if ( event.keyCode === 89 ) // crtl-y
            {
                undoStack.redo();
            }
            else if ( event.keyCode === 90 ) // crtl-z
            {
                undoStack.undo();
            }
        }
    };

    // Internal mebers shortcuts-----------------------------------------------

    /**
     * Reset the display
     */
    this.resetDisplay = function () {
        self.resetLayout();
        self.initWLDisplay();
    };

    /**
     * Reset the app zoom.s
     */
    this.resetZoom = function () {
        self.resetLayout();
    };

    /**
     * Set the colour map.
     * @param {String} colourMap The colour map name.
     */
    this.setColourMap = function (colourMap) {
        viewController.setColourMapFromName(colourMap);
    };

    /**
     * Set the window/level preset.
     * @param {String} event The window/level preset.
     */
    this.setWindowLevelPreset = function (preset) {
        viewController.setWindowLevelPreset(preset);
    };

    /**
     * Set the tool
     * @param {String} tool The tool.
     */
    this.setTool = function (tool) {
        toolboxController.setSelectedTool(tool);
    };

    /**
     * Set the draw shape.
     * @param {String} shape The draw shape.
     */
    this.setDrawShape = function (shape) {
        toolboxController.setSelectedShape(shape);
    };

    /**
     * Set the image filter
     * @param {String} filter The image filter.
     */
    this.setImageFilter = function (filter) {
        toolboxController.setSelectedFilter(filter);
    };

    /**
     * Run the selected image filter.
     */
    this.runImageFilter = function () {
        toolboxController.runSelectedFilter();
    };

    /**
     * Set the draw line colour.
     * @param {String} colour The line colour.
     */
    this.setDrawLineColour = function (colour) {
        toolboxController.setLineColour(colour);
    };

    /**
     * Set the filter min/max.
     * @param {Object} range The new range of the data: {min:a, max:b}.
     */
    this.setFilterMinMax = function (range) {
        toolboxController.setRange(range);
    };

    /**
     * Undo the last action
     * @fires dwv.tool.UndoStack#undo
     */
    this.undo = function () {
        undoStack.undo();
    };

    /**
     * Redo the last action
     * @fires dwv.tool.UndoStack#redo
     */
    this.redo = function () {
        undoStack.redo();
    };


    // Private Methods -----------------------------------------------------------

    /**
     * Fire an event: call all associated listeners.
     * @param {Object} event The event to fire.
     * @private
     */
    function fireEvent (event)
    {
        if ( typeof listeners[event.type] === "undefined" ) {
            return;
        }
        for ( var i = 0; i < listeners[event.type].length; ++i )
        {
            listeners[event.type][i](event);
        }
    }

    /**
     * Generate the image data and draw it.
     * @private
     */
    function generateAndDrawImage()
    {
        // generate image data from DICOM
        view.generateImageData(imageData);
        // set the image data of the layer
        imageLayer.setImageData(imageData);
        // draw the image
        imageLayer.draw();
    }

    /**
     * Apply the stored zoom to the layers.
     * @private
     * @fires dwv.App#zoom-change
     */
    function zoomLayers()
    {
        // image layer
        if( imageLayer ) {
            imageLayer.zoom(scale, scale, scaleCenter.x, scaleCenter.y);
            imageLayer.draw();
        }
        // draw layer
        if( drawController ) {
            drawController.zoomStage(scale, scaleCenter);
        }
        // fire event
        /**
         * Zoom change event.
         * @event dwv.App#zoom-change
         * @type {Object}
         * @property {number} scale The new scale value.
         * @property {number} cx The new rotaion center X position.
         * @property {number} cx The new rotaion center Y position.
         */
        fireEvent({
            "type": "zoom-change",
            "scale": scale,
            "cx": scaleCenter.x,
            "cy": scaleCenter.y
        });
    }

    /**
     * Apply the stored translation to the layers.
     * @private
     * @fires dwv.App#offset-change
     */
    function translateLayers()
    {
        // image layer
        if( imageLayer ) {
            imageLayer.translate(translation.x, translation.y);
            imageLayer.draw();
            // draw layer
            if( drawController ) {
                var ox = - imageLayer.getOrigin().x / scale - translation.x;
                var oy = - imageLayer.getOrigin().y / scale - translation.y;
                drawController.translateStage(ox, oy);
            }
            // fire event
            /**
             * Offset change event.
             * @event dwv.App#offset-change
             * @type {Object}
             * @property {number} scale The new scale value.
             * @property {number} cx The new rotaion center X position.
             * @property {number} cx The new rotaion center Y position.
             */
            fireEvent({
                "type": "offset-change",
                "scale": scale,
                "cx": imageLayer.getTrans().x,
                "cy": imageLayer.getTrans().y
            });
        }
    }

    /**
     * Create the application layers.
     * @param {Number} dataWidth The width of the input data.
     * @param {Number} dataHeight The height of the input data.
     * @private
     */
    function createLayers(dataWidth, dataHeight)
    {
        // image layer
        var canImgLay = self.getElement("imageLayer");
        imageLayer = new dwv.html.Layer(canImgLay);
        imageLayer.initialise(dataWidth, dataHeight);
        imageLayer.fillContext();
        imageLayer.setStyleDisplay(true);
        // draw layer
        var drawDiv = self.getElement("drawDiv");
        if ( drawDiv ) {
            drawController = new dwv.DrawController(drawDiv);
            drawController.create(dataWidth, dataHeight);
        }
        // resize app
        self.fitToSize(self.getLayerContainerSize());

        self.resetLayout();
    }

    /**
     * Data load start callback.
     * @param {Object} event The load start event.
     * @private
     */
    function onloadstart(event) {
        if (event.loadtype === "image") {
            self.reset();
        }

        /**
         * Main load start event.
         * @event dwv.LoadController#load-start
         * @type {Object}
         * @property {Object} event The original event.
         */
        event.type = "load-start";
        fireEvent(event);
    }

    /**
     * Data load error callback.
     * @param {Object} event The error event.
     * @private
     */
    function onprogress(event) {
        fireEvent(event);
    }

    /**
     * Data load callback.
     * @param {Object} data The loaded data.
     * @private
     */
    function onloaditem(event) {
        // check event
        if (typeof event.data === "undefined") {
            console.error("Missing data.");
        }
        if (typeof event.loadtype === "undefined") {
            console.error("Missing load type.");
        }

        var metaData = null;
        if (event.loadtype === "image") {
            if ( image ) {
                view.append( event.data.view );
            }
            postLoadInit(event.data);
            metaData = event.data.info;
        } else if (event.loadtype === "state") {
            var state = new dwv.State();
            state.apply( self, state.fromJSON(event.data) );
            metaData = "state";
        }

        /**
         * Load slice event.
         * @event dwv.LoadController#load-slice
         * @type {Object}
         * @property {Object} event The original event.
         */
        fireEvent({
            type: "load-item",
            data: metaData,
            source: event.source,
            loadtype: event.loadtype
        });
    }

    /**
     * Data load callback.
     * @param {Object} event The load event.
     * @private
     */
    function onload(event) {
        if ( drawController ) {
            drawController.activateDrawLayer(viewController);
        }

        /**
         * Load slice event.
         * @event dwv.LoadController#load-slice
         * @type {Object}
         * @property {Object} event The original event.
         */
        event.type = "load";
        fireEvent(event);
    }

    /**
     * Data load end callback.
     * @param {Object} event The load end event.
     * @private
     */
    function onloadend(event) {
        /**
         * Main load end event.
         * @event dwv.LoadController#load-end
         * @type {Object}
         * @property {Object} event The original event.
         */
        event.type = "load-end";
        fireEvent(event);
    }

    /**
     * Data load error callback.
     * @param {Object} event The error event.
     * @private
     */
    function onerror(event) {
        /**
         * Load error event.
         * @event dwv.LoadController#load-error
         * @type {Object}
         * @property {Object} event The original event.
         */
        event.type = "load-error";
        fireEvent(event);
    }

    /**
     * Data load abort callback.
     * @param {Object} event The abort event.
     * @private
     */
    function onabort(event) {
        /**
         * Load abort event.
         * @event dwv.LoadController#load-abort
         * @type {Object}
         * @property {Object} event The original event.
         */
        event.type = "load-abort";
        fireEvent(event);
    }

    /**
     * Post load application initialisation. To be called once the DICOM has been parsed.
     * @param {Object} data The data to display.
     * @private
     */
    function postLoadInit(data)
    {
        // store the meta data
        if (dwv.utils.isArray(data.info)) {
            // image file case
            // TODO merge?
            metaData = data.info;
        } else {
            // DICOM data case
            var dataInfo = new dwv.dicom.DicomElementsWrapper(data.info);
            var dataInfoObj = dataInfo.dumpToObject();
            if (metaData) {
                metaData = dwv.utils.mergeObjects(
                    metaData,
                    dataInfoObj,
                    "InstanceNumber",
                    "value");
            } else {
                metaData = dataInfoObj;
            }
        }

        // only initialise the first time
        if ( view ) {
            return;
        }

        // get the view from the loaded data
        view = data.view;
        viewController = new dwv.ViewController(view);

        // store image
        originalImage = view.getImage();
        image = originalImage;

        // layout
        var size = image.getGeometry().getSize();
        dataWidth = size.getNumberOfColumns();
        dataHeight = size.getNumberOfRows();
        createLayers(dataWidth, dataHeight);

        // get the image data from the image layer
        imageData = imageLayer.getContext().createImageData(
                dataWidth, dataHeight);

        // image listeners
        view.addEventListener("wl-width-change", onWLChange);
        view.addEventListener("wl-center-change", onWLChange);
        view.addEventListener("colour-change", onColourChange);
        view.addEventListener("slice-change", onSliceChange);
        view.addEventListener("frame-change", onFrameChange);

        // connect with local listeners
        view.addEventListener("wl-width-change", fireEvent);
        view.addEventListener("wl-center-change", fireEvent);
        view.addEventListener("wl-preset-add", fireEvent);
        view.addEventListener("colour-change", fireEvent);
        view.addEventListener("position-change", fireEvent);
        view.addEventListener("slice-change", fireEvent);
        view.addEventListener("frame-change", fireEvent);

        // append draw layers (before initialising the toolbox)
        if ( drawController ) {
            //drawController.appendDrawLayer(image.getNumberOfFrames());
        }

        // initialise the toolbox
        if ( toolboxController ) {
            toolboxController.init( imageLayer );
        }

        // init W/L display
        self.initWLDisplay();
        // generate first image
        generateAndDrawImage();
    }

};
