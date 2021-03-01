importScripts('dicomElementsWrapper.js', 'dicomParser.js', 'logger.js');

self.addEventListener('message', function (event) {
    var dicomParser = new dwv.dicom.DicomParser();
    dicomParser.setDefaultCharacterSet(event.data.defaultCharacterSet);
    dicomParser.parse(event.data.buffer);
    self.postMessage([dicomParser.getRawDicomElements(), event.data.origin, event.data.dataIndex]);
}, false);
