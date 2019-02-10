'use strict';

 angular.module('app')
 .controller('MainCtrl', function ($scope, $mdSidenav) {
  $scope.toggle = function () {
    $mdSidenav('leftMenu').toggle();
  }
});
