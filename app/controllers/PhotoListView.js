//
// This is the controller for the PhotoListView, it has a matching .tss and .xml
// file which represent the styles and the presentation layer associated with
// this controller
//
// NOTE: Controllers for Tabs are all loaded when the tabGroup is opened, NOT when the
// tabs is switched to.
//

// variables passed into the controller
var args = arguments[0] || {};

// will use this for promises the same way we did in Ionic
var Q = require('q');

// http://docs.appcelerator.com/titanium/latest/#!/api/Titanium.Cloud
// make sure you add the module in tiapp.xml
var parseService = Alloy.Globals.parseService = require('parseREST');

// using for time formatting - http://momentjs.com/
var moment = require('moment');

var ImageFactory = require('ti.imagefactory');

var utils = require('utilities');

Ti.API.info('Loaded PhotoListView Controller');

/**
 * a public function for loading the images from ACS into a view for
 * the purpose of demonstrating ListViews and ListViewTemplates
 *
 * @param {Function} _callback - used with pull to refresh to  restore
 * screen when data is done loading
 */
$.loadImages = function loadImages(_callback) {
    Ti.API.info('PhotoListView Controller: loadImages');

    utils.showIndicator();

    // call ACS to get current List of photos
    parseService.getObjects("ImageInfo", {}).then(function(_data) {
        var _photos = _data.response.results;
        Ti.API.info("_photos: " + JSON.stringify(_photos, null, 2));

        // add photos to UI
        addPhotosToListView(_photos);

    }).finally(function() {
        utils.hideIndicator();

        // indicate we are finished loading, used by
        // refreshed
        _callback && _callback();

    }, function(_error) {
        alert('Error:\n' + ((_error.error && _error.message) || JSON.stringify(_error)));
    });
};

/**
 *
 */
function addPhotosToListView(_photos) {

    // empty the list out
    $.listViewSection.deleteItemsAt(0, $.listViewSection.items.length);

    for (var i = _photos.length - 1; i >= 0; i--) {

        // _photos[i].created_at - format the date using moment library
        var convertedDate = moment(_photos[i].createdAt).format('MMMM Do YYYY, h:mm:ss a');
        var dateAndName = _photos[i].caption + " - " + convertedDate;

        var listItem = {
            properties : {
                photoObject : _photos[i]
            },
            fileName : {
                text : _photos[i].picture.name
            },
            dateCreated : {
                //text :
                text : dateAndName
            },
            template : 'listViewTemplate',
            thumbImage : {
                image : _photos[i].thumbBase64 ? Titanium.Utils.base64decode(_photos[i].thumbBase64 + "") : _photos[i].picture.url
            }
        };

_photos[i].thumbBase64 ? console.log("length " + _photos[i].thumbBase64.length) : ""

        $.listViewSection.appendItems([listItem]);
    }
}

/**
 * called when user pulls down on list
 *
 * @param {Object} _event
 */
function refreshData(_event) {
    $.loadImages(function() {
        _event.hide();
    });
}

function listItemClicked(_event) {

    var currentItem = $.listViewSection.getItemAt(_event.itemIndex);
    var selectedObject = currentItem.properties.photoObject;

    // log for debugging purposes and convert object to
    // string that is readable
    console.log("selectedObject " + JSON.stringify(selectedObject, null, 2));

    // create the new controller and pass in the
    // model object as an argument 'item'
    var ctrl = Alloy.createController('PhotoDetail', {
        'item' : selectedObject,
        'photoListTab' : $.photoListTab
    });

    setTimeout(function() {
        $.photoListTab.open(ctrl.detailWindow);
    }, 200);
}

/**
 * http://docs.appcelerator.com/titanium/3.0/#!/guide/Camera_and_Photo_Gallery_APIs
 */
function addPhoto() {

    function getImageFromSource(_source) {
        Ti.Media[_source]({
            success : function(event) {
                // called when media returned from the camera
                Ti.API.debug('Our type was: ' + event.mediaType);
                if (event.mediaType == Ti.Media.MEDIA_TYPE_PHOTO) {

                    // now save the photo with no location
                    savePhoto(event.media, {});

                } else {
                    alert("got the wrong type back =" + event.mediaType);
                }
            },
            cancel : function() {
                // called when user cancels taking a picture
            },
            error : function(error) {
                // called when there's an error
                if (error.code == Titanium.Media.NO_CAMERA) {
                    alert('Please run this test on device');
                } else {
                    alert('Unexpected error: ' + error.code);
                }
            },
            saveToPhotoGallery : true,
            // allowEditing and mediaTypes are iOS-only settings
            allowEditing : true,
            // only photo, no videos in this sample
            mediaTypes : [Ti.Media.MEDIA_TYPE_PHOTO]
        });
    }


    $.optionDialog.dialog.addEventListener('click', function handleClick(_event) {

        if (_event.index === 0) {
            getImageFromSource("showCamera");
        } else if (_event.index === 1) {
            getImageFromSource("openPhotoGallery");
        }

    });

    $.optionDialog.dialog.show();

};

$.addPhoto = addPhoto;

/**
 *
 * @param {Object} _imageData
 * @param {Object} _locationInformation
 */
function savePhoto(_imageData, _locationInformation) {

    //utils.showindicator();

    // compress image for better uploading

    var imageCompressed,
        thumbBlob,
        thumbBase64;

    if (OS_ANDROID || _imageData.width > 700) {
        var w,
            h;
        w = _imageData.width * .50;
        h = _imageData.height * .50;
        imageCompressed = _imageData.imageAsResized(w, h);
    } else {
        // we do not need to compress here
        imageCompressed = _imageData;
    }

    // create a small thumbnail for display purposes in base64 and save in row
    // this way we don't need to render the huge original image
    thumbBlob = imageCompressed.imageAsThumbnail(128);

    // store as a base64 string
    thumbBase64 = Titanium.Utils.base64encode(thumbBlob);

    parseService.uploadFile("image/jpeg", Ti.Platform.createUUID() + ".jpeg", imageCompressed).then(function(_results) {
        return parseService.createObject('ImageInfo', {
            "caption" : _results.response.name,
            "thumbBase64" : thumbBase64 + "",
            "picture" : {
                "name" : _results.response.name,
                "__type" : "File"
            }
        }).then(function(_results2) {
            console.log("FileHelper Object: " + JSON.stringify(_results2));

            return $.photoListView.loadImages();
        }, function(_error) {
            console.log("ERROR: " + JSON.stringify(_error));
        });
    });

}

// Button Event
OS_IOS && $.addPhotoBtn.addEventListener('click', addPhoto);
