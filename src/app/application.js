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
    // Is the data mono-slice?
    var isMonoSliceData = 0;

    // Default character set
    var defaultCharacterSet;

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

    // Current loader
    var currentLoader = null;

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
    this.isMonoSliceData = function () { return isMonoSliceData; };
    /**
     * Is the data mono-frame?
     * @return {Boolean} True if the data only contains one frame.
     */
    this.isMonoFrameData = function () {
        return this.getImage().getNumberOfFrames() === 1;
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
     * @param {Object} The command to add.
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
            for ( var t = 0; t < config.tools.length; ++t ) {
                var toolName = config.tools[t];
                if ( toolName === "Draw" ) {
                    if ( typeof config.shapes !== "undefined" && config.shapes.length !== 0 ) {
                        // setup the shape list
                        var shapeFactoryList = {};
                        for ( var s = 0; s < config.shapes.length; ++s ) {
                            var shapeName = config.shapes[s];
                            var shapeFactoryClass = shapeName+"Factory";
                            if (typeof dwv.tool[shapeFactoryClass] !== "undefined") {
                                shapeFactoryList[shapeName] = dwv.tool[shapeFactoryClass];
                            }
                            else {
                                console.warn("Could not initialise unknown shape: "+shapeName);
                            }
                        }
                        toolList.Draw = new dwv.tool.Draw(this, shapeFactoryList);
                        toolList.Draw.addEventListener("draw-create", fireEvent);
                        toolList.Draw.addEventListener("draw-change", fireEvent);
                        toolList.Draw.addEventListener("draw-move", fireEvent);
                        toolList.Draw.addEventListener("draw-delete", fireEvent);
                    } else {
                        console.warn("Please provide a list of shapes in the application configuration to activate the Draw tool.");
                    }
                }
                else if ( toolName === "Filter" ) {
                    if ( typeof config.filters !== "undefined" && config.filters.length !== 0 ) {
                        // setup the filter list
                        var filterList = {};
                        for ( var f = 0; f < config.filters.length; ++f ) {
                            var filterName = config.filters[f];
                            if (typeof dwv.tool.filter[filterName] !== "undefined") {
                                filterList[filterName] = new dwv.tool.filter[filterName](this);
                            }
                            else {
                                console.warn("Could not initialise unknown filter: "+filterName);
                            }
                        }
                        toolList.Filter = new dwv.tool.Filter(filterList, this);
                        toolList.Filter.addEventListener("filter-run", fireEvent);
                        toolList.Filter.addEventListener("filter-undo", fireEvent);
                    } else {
                        console.warn("Please provide a list of filters in the application configuration to activate the Filter tool.");
                    }
                }
                else {
                    // default: find the tool in the dwv.tool namespace
                    var toolClass = toolName;
                    if (typeof dwv.tool[toolClass] !== "undefined") {
                        toolList[toolClass] = new dwv.tool[toolClass](this);
                        if (typeof toolList[toolClass].addEventListener !== "undefined") {
                            toolList[toolClass].addEventListener(fireEvent);
                        }
                    }
                    else {
                        console.warn("Could not initialise unknown tool: "+toolName);
                    }
                }
            }
            toolboxController = new dwv.ToolboxController(toolList);
        }

        // listen to window resize
        window.onresize = onResize;

        // default character set
        if ( typeof config.defaultCharacterSet !== "undefined" ) {
            defaultCharacterSet = config.defaultCharacterSet;
        }
    };

    /**
     * Get the size of the layer container div.
     * @return {width, height} The width and height of the div.
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
        isMonoSliceData = false;
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
            fireEvent({"type": "zoom-change", "scale": scale, "cx": scaleCenter.x, "cy": scaleCenter.y });
        }
        if ( (previousSC.x !== scaleCenter.x || previousSC.y !== scaleCenter.y) ||
             (previousTrans.x !== translation.x || previousTrans.y !== translation.y)) {
            fireEvent({"type": "offset-change", "scale": scale, "cx": scaleCenter.x, "cy": scaleCenter.y });
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

    /**
     * Load a list of files. Can be image files or a state file.
     * @param {Array} files The list of files to load.
     */
    this.loadFiles = function (files)
    {
        // has been checked for emptiness.
        var ext = files[0].name.split('.').pop().toLowerCase();
        if ( ext === "json" ) {
            loadStateFile(files[0]);
        }
        else {
            loadImageFiles(files);
        }
    };

    /**
     * Load a list of image files.
     * @private
     * @param {Array} files The list of image files to load.
     */
    function loadImageFiles(files)
    {
        // create IO
        var fileIO = new dwv.io.FilesLoader();
        // load data
        loadImageData(files, fileIO);
    }

    /**
     * Load a State file.
     * @private
     * @param {String} file The state file to load.
     */
    function loadStateFile(file)
    {
        // create IO
        var fileIO = new dwv.io.FilesLoader();
        // load data
        loadStateData([file], fileIO);
    }

    /**
     * Load a list of URLs. Can be image files or a state file.
     * @param {Array} urls The list of urls to load.
     * @param {Array} requestHeaders An array of {name, value} to use as request headers.
     */
    this.loadURLs = function (urls, requestHeaders)
    {
        // has been checked for emptiness.
        var ext = urls[0].split('.').pop().toLowerCase();
        if ( ext === "json" ) {
            loadStateUrl(urls[0], requestHeaders);
        }
        else {
            loadImageUrls(urls, requestHeaders);
        }
    };

    /**
     * Abort the current load.
     */
    this.abortLoad = function ()
    {
        if ( currentLoader ) {
            currentLoader.abort();
            currentLoader = null;
        }
    };

    /**
     * Load a list of ArrayBuffers.
     * @param {Array} data The list of ArrayBuffers to load
     *   in the form of [{name: "", filename: "", data: data}].
     */
    this.loadImageObject = function (data)
    {
        // create IO
        var memoryIO = new dwv.io.MemoryLoader();
        // create options
        var options = {};
        // load data
        loadImageData(data, memoryIO, options);
    };

    /**
     * Load a list of image URLs.
     * @private
     * @param {Array} urls The list of urls to load.
     * @param {Array} requestHeaders An array of {name, value} to use as request headers.
     */
    function loadImageUrls(urls, requestHeaders)
    {
        // create IO
        var urlIO = new dwv.io.UrlsLoader();
        // create options
        var options = {'requestHeaders': requestHeaders};
        // load data
        loadImageData(urls, urlIO, options);
    }

    /**
     * Load a State url.
     * @private
     * @param {String} url The state url to load.
     * @param {Array} requestHeaders An array of {name, value} to use as request headers.
     */
    function loadStateUrl(url, requestHeaders)
    {
        // create IO
        var urlIO = new dwv.io.UrlsLoader();
        // create options
        var options = {'requestHeaders': requestHeaders};
        // load data
        loadStateData([url], urlIO, options);
    }

    /**
     * Load a list of image data.
     * @private
     * @param {Array} data Array of data to load.
     * @param {Object} loader The data loader.
     * @param {Object} options Options passed to the final loader.
     */
    function loadImageData(data, loader, options)
    {
        // store loader
        currentLoader = loader;

        // allow to cancel
        var previousOnKeyDown = window.onkeydown;
        window.onkeydown = function (event) {
            if (event.ctrlKey && event.keyCode === 88 ) // crtl-x
            {
                console.log("crtl-x pressed!");
                self.abortLoad();
            }
        };

        // clear variables
        self.reset();
        // first data name
        var firstName = "";
        if (typeof data[0].name !== "undefined") {
            firstName = data[0].name;
        } else {
            firstName = data[0];
        }
        // flag used by scroll to decide wether to activate or not
        // TODO: supposing multi-slice for zip files, could not be...
        isMonoSliceData = (data.length === 1 &&
            firstName.split('.').pop().toLowerCase() !== "zip" &&
            !dwv.utils.endsWith(firstName, "DICOMDIR") &&
            !dwv.utils.endsWith(firstName, ".dcmdir") );
        // set IO
        loader.setDefaultCharacterSet(defaultCharacterSet);
        loader.onload = function (data) {
            fireEvent({'type': 'load-slice', 'data': data.info});
            if ( image ) {
                view.append( data.view );
                if ( drawController ) {
                    //drawController.appendDrawLayer(image.getNumberOfFrames());
                }
            }
            postLoadInit(data);
        };
        loader.onerror = function (error) { handleLoadError(error); };
        loader.onabort = function (error) { handleLoadAbort(error); };
        loader.onloadend = function (/*event*/) {
            window.onkeydown = previousOnKeyDown;
            if ( drawController ) {
                drawController.activateDrawLayer(viewController);
            }
            fireEvent({type: "load-progress", lengthComputable: true,
                loaded: 100, total: 100});
            fireEvent({ 'type': 'load-end' });
            // reset member
            currentLoader = null;
        };
        loader.onprogress = fireEvent;
        // main load (asynchronous)
        fireEvent({ 'type': 'load-start' });
        loader.load(data, options);
    }

    /**
     * Load a State data.
     * @private
     * @param {Array} data Array of data to load.
     * @param {Object} loader The data loader.
     * @param {Object} options Options passed to the final loader.
     */
    function loadStateData(data, loader, options)
    {
        // set IO
        loader.onload = function (data) {
            // load state
            var state = new dwv.State();
            state.apply( self, state.fromJSON(data) );
        };
        loader.onerror = function (error) { handleLoadError(error); };
        // main load (asynchronous)
        loader.load(data, options);
    }

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
     */
    function onColourChange(/*event*/)
    {
        generateAndDrawImage();
    }

    /**
     * Handle frame change.
     * @param {Object} event The event fired when changing the frame.
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
     */
    this.undo = function () {
        undoStack.undo();
    };

    /**
     * Redo the last action
     */
    this.redo = function () {
        undoStack.redo();
    };


    // Private Methods -----------------------------------------------------------

    /**
     * Fire an event: call all associated listeners.
     * @param {Object} event The event to fire.
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
        fireEvent({"type": "zoom-change", "scale": scale, "cx": scaleCenter.x, "cy": scaleCenter.y });
    }

    /**
     * Apply the stored translation to the layers.
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
            fireEvent({"type": "offset-change", "scale": scale,
                "cx": imageLayer.getTrans().x, "cy": imageLayer.getTrans().y });
        }
    }

    /**
     * Handle an error: display it to the user.
     * @private
     * @param {Object} error The error to handle.
     */
    function handleLoadError(error)
    {
        // log
        console.error(error);
        // event message
        var displayMessage = "";
        if ( error.name && error.message) {
            displayMessage = error.name + ": " + error.message;
        } else {
            displayMessage = "Error: " + error + ".";
        }
        // fire error event
        fireEvent({"type": "load-error", "message": displayMessage});
    }

    /**
     * Handle an abort: display it to the user.
     * @param {Object} error The error to handle.
     * @private
     */
    function handleLoadAbort(error)
    {
        // log
        console.warn(error);
        // event message
        var displayMessage = "";
        if ( error && error.message ) {
            displayMessage = error.message;
        } else {
            displayMessage = "Abort called.";
        }
        // fire error event
        fireEvent({"type": "load-abort", "message": displayMessage});
    }

    /**
     * Create the application layers.
     * @private
     * @param {Number} dataWidth The width of the input data.
     * @param {Number} dataHeight The height of the input data.
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
     * Post load application initialisation. To be called once the DICOM has been parsed.
     * @private
     * @param {Object} data The data to display.
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
