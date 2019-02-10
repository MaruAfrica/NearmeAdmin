'use strict';

angular.module('app')
  .controller('PlaceCtrl',
    function ($scope, $mdDialog, Toast, $translate, Place, Category, Auth) {

      // Pagination options
      $scope.rowOptions = [5, 25, 50];

      $scope.query = {
        canonical: '',
        limit: 5,
        page: 1,
        total: 0,
        isFeatured: null,
        status: null,
        category: null,
        date: null
      };

      $scope.places = [];

      var loadPlaces = function () {
        Auth.ensureLoggedIn().then(function () {
          $scope.promise = Place.all($scope.query).then(function (places) {
            $scope.places = places;
          });
        });
      };

      loadPlaces();

      var loadCount = function () {
        Auth.ensureLoggedIn().then(function () {
          Place.count($scope.query).then(function (total) {
            $scope.query.total = total;
          });
        });
      }

      loadCount();

      var loadCategories = function () {
        var params = {
          page: 1,
          limit: 1000,
          canonical: '',
          order: 'title'
        }

        Auth.ensureLoggedIn().then(function () {
          Category.all(params).then(function (categories) {
            $scope.categories = categories;
          });
        });
      }

      loadCategories();

      $scope.onReload = function () {
        $scope.query.page = 1;
        $scope.query.total = 0;
        loadPlaces();
        loadCount();
      }

      $scope.onEdit = function (ev, obj) {

        $mdDialog.show({
            controller: 'DialogPlaceController',
            templateUrl: '/views/partials/place.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            locals: {
              obj: obj || null
            },
            clickOutsideToClose: true
          })
          .then(function (response) {

            if (response) {
              loadPlaces();
              loadCount();
            }

          });
      };

      $scope.onPaginationChange = function (page, limit) {
        $scope.query.page = page;
        $scope.query.limit = limit;
        loadPlaces();
      };

      $scope.onExpiresAtClicked = function (ev, obj) {

        $mdDialog.show({
          controller: 'DialogPlaceExpiresAtController',
          templateUrl: '/views/partials/expiration-modal.html',
          parent: angular.element(document.body),
          targetEvent: ev,
          clickOutsideToClose: true,
          locals: {
            obj: obj
          }
        });

      }

      $scope.onDelete = function (ev, obj) {

        $translate(['DELETE', 'CONFIRM_DELETE', 'CONFIRM', 'CANCEL', 'DELETED']).then(function (str) {

          var confirm = $mdDialog.confirm()
            .title(str.DELETE)
            .textContent(str.CONFIRM_DELETE)
            .ariaLabel(str.DELETE)
            .ok(str.CONFIRM)
            .cancel(str.CANCEL);
          $mdDialog.show(confirm).then(function () {


            Place.delete(obj).then(function () {
              $translate('DELETED').then(function (str) {
                Toast.show(str);
              });
              loadPlaces();
              loadCount();
            }, function (error) {
              Toast.show(error.message);
            });
          });

        });
      };

    }).controller('DialogPlaceController', function (
    $scope, $mdDialog, Toast, $translate, Place, Category, File, NgMap, GeoCoder, obj) {

    var marker, map;

    $scope.placeFromGooglePlaces = null;

    $scope.autocompleteOptions = {}

    $scope.tinymceOptions = {
      height: 500,
      skin: 'lightgray',
      theme: 'modern',
      content_style: "img { max-width: 100%; height: auto; }",
      image_dimensions: false,
      media_dimensions: false,
      media_live_embeds: true,
      file_picker_types: 'image media',
      relative_urls: false,
      remove_script_host: false,
      file_picker_callback: function (cb, value, meta) {

        var input = document.createElement('input');
        input.setAttribute('type', 'file');

        if (meta.filetype == 'image') {
          input.setAttribute('accept', 'image/*');
        }

        if (meta.filetype == 'media') {
          input.setAttribute('accept', 'video/*');
        }

        input.onchange = function () {
          var file = this.files[0];

          File.upload(file, file.name).then(function (savedFile) {
            cb(savedFile.url(), {
              title: savedFile.name()
            });
          })

        };

        input.click();
      },
      extended_valid_elements: 'iframe[src|width|height|name|align|frameborder|scrolling]',
      plugins: 'link image code media imagetools hr table lists searchreplace wordcount visualblocks visualchars code fullscreen emoticons',
      toolbar: 'formatselect | bold italic strikethrough forecolor backcolor | link image media emoticons | alignleft aligncenter alignright alignjustify | numlist bullist outdent indent | removeformat'
    };

    $scope.$watch(function (scope) {
      return scope.placeFromGooglePlaces;
    }, function (newValue) {

      if (newValue) {
        $scope.obj.title = $scope.placeFromGooglePlaces.name;
        $scope.obj.address = $scope.placeFromGooglePlaces.formatted_address;
        $scope.obj.website = $scope.placeFromGooglePlaces.website;
        $scope.obj.phone = $scope.placeFromGooglePlaces.formatted_phone_number;
        $scope.input = {
          latitude: $scope.placeFromGooglePlaces.geometry.location.lat(),
          longitude: $scope.placeFromGooglePlaces.geometry.location.lng()
        };

        $scope.onInputLocationChanged();
      }
    });

    $scope.categories = [];
    $scope.obj = obj || new Place;
    $scope.input = {};

    $scope.images = []

    if ($scope.obj.images) {
      $scope.images = $scope.obj.images.map(function (image) {
        return {
          isUploading: false,
          file: image
        }
      })
    }
    

    if ($scope.obj.location) {
      $scope.input.latitude = $scope.obj.location.latitude;
      $scope.input.longitude = $scope.obj.location.longitude;
    }

    Category.all({
        page: 1,
        limit: 1000,
        filter: ''
      })
      .then(function (categories) {
        $scope.categories = categories;
      });

    $scope.onAddressChanged = function () {
      GeoCoder.geocode({
        address: $scope.obj.address
      }).then(function (result) {

        if (map) {

          var location = result[0].geometry.location;
          location = new google.maps.LatLng(location.lat(), location.lng());

          map.setCenter(location);
          map.setZoom(15);

          marker.setPosition(location);

          $scope.obj.location = new Parse.GeoPoint({
            latitude: location.lat(),
            longitude: location.lng()
          });

          $scope.input.latitude = location.lat();
          $scope.input.longitude = location.lng();
        }
      });
    }

    NgMap.getMap().then(function (objMap) {

      map = objMap;
      marker = map.markers[0];

      // Fix gray area in second render
      google.maps.event.trigger(map, 'resize');

      if ($scope.obj.location) {

        var placeLocation = new google.maps.LatLng(
          $scope.obj.location.latitude,
          $scope.obj.location.longitude);

        map.setCenter(placeLocation)
        marker.setPosition(placeLocation);
        map.setZoom(15);
      } else {
        map.setZoom(1);
        map.setCenter(new google.maps.LatLng(0, 0));
      }
    });


    $scope.onMarkerDragEnd = function (ev) {

      var lat = ev.latLng.lat();
      var lng = ev.latLng.lng();

      $scope.obj.location = new Parse.GeoPoint({
        latitude: lat,
        longitude: lng
      });

      $scope.input.latitude = lat;
      $scope.input.longitude = lng;
    };

    $scope.onInputLocationChanged = function () {

      if ($scope.input.latitude && $scope.input.longitude && map) {

        $scope.obj.location = new Parse.GeoPoint({
          latitude: $scope.input.latitude,
          longitude: $scope.input.longitude
        });

        marker.setPosition(new google.maps.LatLng(
          $scope.input.latitude,
          $scope.input.longitude
        ));

        map.setCenter(new google.maps.LatLng(
          $scope.input.latitude,
          $scope.input.longitude
        ));

        map.setZoom(12);
      }
    }

    $scope.onDeleteImage = function (image) {
      var index = $scope.images.indexOf(image);
      if (index !== -1) {
        $scope.images.splice(index, 1);
      }
    }

    $scope.onImageClicked = function (file) {
      var viewer = ImageViewer();
      viewer.show(file.url());
    }

    $scope.onUploadImage = function (file) {

      if (file) {

        var index = $scope.images.push({
          isUploading: true,
          file: null
        }) - 1;

        $scope.images[index].isUploading = true;

        File.upload(file).then(function (savedFile) {

          $scope.images[index].file = savedFile;
          $scope.images[index].isUploading = false;

        }, function (error) {
          Toast.show(error.message);
          $scope.images[index].isUploading = false;
        });

      }
    };

    $scope.uploadImageOne = function (file, invalidFile) {

      if (file) {

        $scope.isImageOneUploading = true;
        $scope.imageOneFilename = file.name;

        File.upload(file).then(function (savedFile) {

            $scope.obj.image = savedFile;
            $scope.isImageOneUploading = false;
          },
          function (error) {
            $scope.isImageOneUploading = false;
            Toast.show(error.message);
          });

      } else {
        if (invalidFile) {
          if (invalidFile.$error === 'maxSize') {
            Toast.show('Image too big. Max ' + invalidFile.$errorParam);
          }
        }
      }
    };

    $scope.uploadImageTwo = function (file, invalidFile) {

      if (file) {

        $scope.isImageTwoUploading = true;
        $scope.imageTwoFilename = file.name;

        File.upload(file).then(function (savedFile) {

            $scope.obj.imageTwo = savedFile;
            $scope.isImageTwoUploading = false;
          },
          function (error) {
            $scope.isImageTwoUploading = false;
            Toast.show(error.message);
          });

      } else {
        if (invalidFile) {
          if (invalidFile.$error === 'maxSize') {
            Toast.show('Image too big. Max ' + invalidFile.$errorParam);
          }
        }
      }
    }

    $scope.uploadImageThree = function (file, invalidFile) {

      if (file) {

        $scope.isImageThreeUploading = true;
        $scope.imageThreeFilename = file.name;

        File.upload(file).then(function (savedFile) {

            $scope.obj.imageThree = savedFile;
            $scope.isImageThreeUploading = false;
          },
          function (error) {
            $scope.isImageThreeUploading = false;
            Toast.show(error.message);
          });
      } else {
        if (invalidFile) {
          if (invalidFile.$error === 'maxSize') {
            Toast.show('Image too big. Max ' + invalidFile.$errorParam);
          }
        }
      }
    }

    $scope.uploadImageFour = function (file, invalidFile) {

      if (file) {

        $scope.isImageFourUploading = true;
        $scope.imageFourFilename = file.name;

        File.upload(file).then(function (savedFile) {

            $scope.obj.imageFour = savedFile;
            $scope.isImageFourUploading = false;
          },
          function (error) {
            $scope.isImageFourUploading = false;
            Toast.show(error.message);
          });
      } else {
        if (invalidFile) {
          if (invalidFile.$error === 'maxSize') {
            Toast.show('Image too big. Max ' + invalidFile.$errorParam);
          }
        }
      }
    }

    $scope.onClose = function () {
      if ($scope.obj.dirty()) $scope.obj.revert();
      $mdDialog.cancel();
    };

    $scope.onSubmit = function () {

      if (!$scope.obj.location) {
        return $translate('LOCATION_REQUIRED').then(function (str) {
          Toast.show(str);
        });
      }

      $scope.isSaving = true;

      $scope.obj.images = $scope.images.map(function (image) {
        if (image.file) {
          return image.file;
        }
      });

      Place.save($scope.obj).then(function (obj) {
          $translate('SAVED').then(function (str) {
            Toast.show(str);
          });
          $mdDialog.hide(obj);
          $scope.isSaving = false;
        },
        function (error) {
          Toast.show(error.message);
          $scope.isSaving = false;
        });

    };

  }).controller('DialogPlaceExpiresAtController',
    function ($scope, $mdDialog, Toast, $translate, Place, obj) {

      $scope.obj = obj;
      $scope.formData = {};

      $scope.isDayInvalid = function () {
        var days = $scope.formData.days;

        if (days) {
          days = parseInt(days, 10);
          return days < 1;
        }
        return true;
      }

      $scope.onSubmit = function () {

        var expiresAt = moment().add($scope.formData.days, 'days').startOf('day').toDate()
        obj.expiresAt = expiresAt;
        obj.status = 'Approved';

        $scope.isSaving = true;

        Place.save(obj).then(function () {
            $scope.isSaving = false;
            $translate('SAVED').then(function (str) {
              Toast.show(str);
            });
            $scope.onClose();
          },
          function (error) {
            $scope.isSaving = false;
            Toast.show(error.message);
          });
      }

      $scope.onClose = function () {
        $mdDialog.hide();
      };

    }).directive('numbersOnly', function () {
    return {
      require: 'ngModel',
      link: function (scope, element, attr, ngModelCtrl) {
        function fromUser(text) {
          if (text) {
            var transformedInput = text.replace(/[^0-9]/g, '');

            if (transformedInput !== text) {
              ngModelCtrl.$setViewValue(transformedInput);
              ngModelCtrl.$render();
            }
            return transformedInput;
          }
          return undefined;
        }
        ngModelCtrl.$parsers.push(fromUser);
      }
    };
  });