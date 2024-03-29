/*
 * +Gallery Javascript Photo gallery v0.9.4
 * http://plusgallery.net/
 *
 * Copyright 2013, Jeremiah Martin | Twitter: @jeremiahjmartin
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html

 */


jQuery.ajaxSetup({ cache: false });
/*
SLIDEFADE
------------------------------------------------------------------------------------------------------*/

/* Custom plugin for a slide/in out animation with a fade - JJM */

(function ($) {
  $.fn.slideFade = function (speed, callback) {
    var slideSpeed;
    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] == "number") {
        slideSpeed  = arguments[i];
      }
      else {
        var callBack = arguments[i];
      }
    }
    if(!slideSpeed) {
      slideSpeed = 500;
    }
    this.animate({
        opacity: 'toggle',
        height: 'toggle'
      }, slideSpeed,
      function(){
        if( typeof callBack != "function" ) { callBack = function(){}; }
        callBack.call(this);
      }
    );
  };
})( jQuery );

(function ($){
  $.fn.plusGallery = function(options){
    var lmnt = this;
    if(lmnt.length === 0) { return false; }
    var pg = {
      /*user defined Defaults*/
      imagePath: 'images/plusgallery',
      type: null,
      albumTitle: false, //show the album title in single album mode
      albumLimit: 16, //Limit amout of albums to load initially.
      limit: 30, //Limit of photos to load for gallery / more that 60 is dumb, separate them into different albums
      apiKey: '', //used with Flickr
      exclude: null,
      include: null,
      imageData: null,


      /*don't touch*/
      imgArray: [],
      titleArray: [],
      t: '', //timer
      idx: 0,
      imgCount: 0,
      imgTotal: 0,
      winWidth: 1024, //resets
      touch: false,
      titleText: '',

      init: function(){
        var _doc = $(document);
        //check for touch device
        if ("ontouchstart" in document.documentElement) {
          window.scrollTo(0, 1);
          pg.touch = true;
        }

        pg.winWidth = $(window).width();

        //reset some shit in case there is another copy that was loaded.
        $('#pgzoomview').remove();
        //Unbind everything first?
        _doc.off("click", ".pgalbumlink, #pgthumbhome, .pgthumb, .pgzoomarrow, .pgzoomclose, #pgzoomview, #pgzoomslide, .pgzoomimg");

        pg.getDataAttr();

        pg.writeHTML();
        if(pg.albumId !== null
          || pg.type == 'instagram'
          || (pg.type == 'local' && !pg.imageData.hasOwnProperty('albums'))){
          //load single Album
          pg.loadSingleAlbum();
        }
        else if(pg.type == 'local') {
          pg.parseAlbumData(pg.imageData);
        }
        else {
          pg.loadAlbumData();
        }



        //attach loadGallery to the album links
        _doc.on("click", ".pgalbumlink",function(e){
          e.preventDefault();
          $(this).append('<span class="pgloading"></span>');
          var galleryTitle = $(this).children('span').html();
          if(pg.type == 'local') {
            var galleryID = $(this).attr('data-album-index').replace('http://', '').replace('//', '').replace('https://', '');
            pg.parseData(pg.imageData.albums[galleryID],galleryTitle);
          } else {
            var galleryURL = this.href;
            pg.loadGallery(galleryURL,galleryTitle);
          }
        });

        _doc.on("click", "#pgthumbhome",function(e){
          e.preventDefault();
          $('#pgthumbview').slideFade(700);
          $('#pgalbums').slideFade(700);
        });

        //attach links load detail image
        _doc.on('click','.pgthumb',function(e){
          e.preventDefault();
          var idx = $('.pgthumb').index(this);
          pg.loadZoom(idx);
        });

        /*zoom events*/
        _doc.on('click','.pgzoomarrow',function(e){
          e.preventDefault();
          var dir = this.rel;
          pg.prevNext(dir);
          return false;
        });

        _doc.on('click','#pgzoomclose',function(e){
          e.preventDefault();
          pg.unloadZoom();
        });

        clearTimeout(pg.t);
      },

      /*--------------------------

        get all the user defined
        variables from the HTML element

      ----------------------------*/
      getDataAttr: function(){
        //Gallery Type *required
        var dataAttr = lmnt.attr('data-type');

        if(pg.type == null && dataAttr) {
          pg.type = dataAttr;
        }
        else if ( pg.type == null ) {
          throw('You must enter a data type.');
        }

        //Gallery User Id *required if not local
        dataAttr = lmnt.attr('data-userid');
        if(dataAttr) {
          pg.userId = dataAttr;
        }
        else if(pg.type != 'local') {
          throw('You must enter a valid User ID');
        }

        //Limit on the amount photos per gallery
        dataAttr = lmnt.attr('data-limit');
        if(dataAttr) {
          pg.limit = dataAttr;
        }

        //Limit on the amount albums
        dataAttr = lmnt.attr('data-album-limit');
        if(dataAttr) {
          pg.albumLimit = dataAttr;
        }

        //album id to exclude
        dataAttr = lmnt.attr('data-exclude');
        if(dataAttr) {
          pg.exclude = dataAttr.split(',');
        }

        //album ids to include
        dataAttr = lmnt.attr('data-include');
        if(dataAttr) {
          pg.include = dataAttr.split(',');
        }

        //Api key - used with Flickr
        dataAttr = lmnt.attr('data-api-key');
        if(dataAttr) {
          pg.apiKey = dataAttr;
        }

        //Access Token - used with instagram
        dataAttr = lmnt.attr('data-access-token');
        if(dataAttr) {
          pg.accessToken = dataAttr;
        }
        dataAttr = lmnt.attr('data-album-id');
        if(dataAttr) {
          pg.albumId = dataAttr;

          //show hide the album title if we are in single gallery mode
          titleAttr = lmnt.attr('data-album-title');

          if(titleAttr == 'true') {
            pg.albumTitle = true;
          } else {
            pg.albumTitle = false;
          }
        }

        dataAttr = lmnt.attr('data-credit');
        if(dataAttr == 'false') {
          pg.credit = false;
        }

        //Image path
        dataAttr = lmnt.attr('data-image-path');
        if(dataAttr) {
            pg.imagePath = dataAttr;
        }

        //JSON string containing image data *required only for local
        dataAttr = lmnt.attr('data-image-data');
        if(dataAttr) {
          pg.imageData = JSON.parse(dataAttr);
        }
      },

      /*--------------------------

        set up the initial HTML

      ----------------------------*/
      writeHTML: function(){
        var touchClass;
        if(pg.touch){
          touchClass = 'touch';
          lmnt.addClass('touch');
        }
        else {
          touchClass = 'no-touch';
          lmnt.addClass('no-touch');
        }

        lmnt.append(
          '<ul id="pgalbums" class="clearfix"></ul>' +
          '<div id="pgthumbview">' +
            '<ul id="pgthumbs" class="clearfix"></ul>' +
          '</div>'
        );
        $('body').prepend(
          '<div id="pgzoomview" class="pg ' + touchClass + '">' +
            '<a href="#" rel="previous" id="pgzoomclose" title="Close">Close</a>' +
            '<a href="#" rel="previous" id="pgprevious" class="pgzoomarrow" title="previous">Previous</a>' +
            '<a href="#" rel="next" id="pgnext" class="pgzoomarrow" title="Next">Next</a>' +
            '<div id="pgzoomscroll">' +
              '<ul id="pgzoom"></ul>' +
            '</div>' +
          '</div>'
          );

        lmnt.addClass('pg');

        if(pg.credit === true) {
          lmnt.append('<div id="pgcredit"><a href="http://www.plusgallery.net" target="_blank" title="Powered by +GALLERY"><span>+</span>Gallery</a></div>');
        }

        //console.log('pg.albumTitle: ' + pg.albumTitle);

        if(pg.albumTitle === true) {
          $('#pgthumbview').prepend('<ul id="pgthumbcrumbs" class="clearfix"><li id="pgthumbhome">&laquo;</li></ul>');
        }
      },


      /*--------------------------

        Parse the album data from
        the given json string.

      ----------------------------*/
      parseAlbumData: function(json) {
        lmnt.addClass('loaded');
        var objPath,
            albumTotal,
            galleryImage,
            galleryTitle,
            galleryJSON;

        switch(pg.type)
        {
        //have to load differently for for google/facebook/flickr
        case 'google':

          objPath = json.feed.entry;
          albumTotal = objPath.length;

          if(albumTotal > pg.albumLimit) {
            albumTotal = pg.albumLimit;
          }

          //remove excluded galleries if there are any.
          //albumTotal = albumTotal - pg.exclude.length;

          if(albumTotal > 0){
            $.each(objPath,function(i,obj){
              //obj is entry
              if(i < albumTotal){
                galleryTitle = obj.title.$t;
                galleryJSON = obj.link[0].href;
                galleryImage = obj.media$group.media$thumbnail[0].url;
                galleryImage = galleryImage.replace('s160','s210');

                pg.loadAlbums(galleryTitle,galleryImage,galleryJSON,i);
              }

            });
          }
          else { //else if albumTotal == 0
            throw('There are either no results for albums with this user ID or there was an error loading the data. \n' + galleryJSON);
          }
        break;
        case 'flickr':

          objPath = json.photosets.photoset;
          albumTotal = objPath.length;

          if(albumTotal > pg.albumLimit) {
            albumTotal = pg.albumLimit;
          }

          if(albumTotal > 0 ) {
            $.each(objPath,function(i,obj){
              //obj is entry
              if(i < albumTotal){
                galleryTitle = obj.title._content;
                galleryImage = 'https://farm' + obj.farm + '.staticflickr.com/' + obj.server + '/' + obj.primary + '_' + obj.secret + '_n.jpg';
                galleryJSON = 'https://api.flickr.com/services/rest/?&method=flickr.photosets.getPhotos&api_key=' + pg.apiKey + '&photoset_id=' + obj.id + '=&format=json&jsoncallback=?';

                pg.loadAlbums(galleryTitle,galleryImage,galleryJSON);
              }
            });
          }
          else { //else if albumTotal == 0
            throw('There are either no results for albums with this user ID or there was an error loading the data. \n' + galleryJSON);
          }
        break;
        case 'facebook':
          objPath = json.data;
          albumTotal = objPath.length;

          if(albumTotal > pg.albumLimit) {
            albumTotal = pg.albumLimit;
          }

          if(albumTotal > 0) {
            $.each(objPath,function(i,obj){
              if(i < albumTotal){
                galleryTitle = obj.name;
                galleryJSON = 'https://graph.facebook.com/' + obj.id + '/photos?limit=' + pg.limit + '&access_token=' + pg.accessToken;
                galleryImage = 'http://graph.facebook.com/' + obj.id + '/picture?type=album';
                pg.loadAlbums(galleryTitle,galleryImage,galleryJSON);
              }

            });
          }
          else {
            throw('There are either no results for albums with this user ID or there was an error loading the data. \n' + albumURL);
          }
          break;
        case 'local':
          objPath = json.albums;
          albumTotal = objPath.length;

          if(albumTotal > pg.albumLimit) {
            albumTotal = pg.albumLimit;
          }

          if(albumTotal > 0 ) {
            $.each(objPath,function(i,obj){
              //obj is entry
              if(i < albumTotal){
                galleryTitle = obj.title;
                galleryImage = obj.images[0].th;
                galleryJSON = 'http://'+i;

                pg.loadAlbums(galleryTitle,galleryImage,galleryJSON);
              }
            });
          }
          else { //else if albumTotal == 0
            throw('There are no albums available in the specified JSON.');
          }
          break;
        }
      },


      /*--------------------------

        Load up Album Data JSON
        before Albums

      ----------------------------*/
      loadAlbumData: function() {
        var albumURL;
        switch(pg.type)
        {
        case 'google':
          albumURL = 'https://picasaweb.google.com/data/feed/base/user/' + pg.userId + '?alt=json&kind=album&hl=en_US&max-results=' + pg.albumLimit + '&callback=?';
          break;
        case 'flickr':
          albumURL = 'https://api.flickr.com/services/rest/?&method=flickr.photosets.getList&api_key=' + pg.apiKey + '&user_id=' + pg.userId + '&format=json&jsoncallback=?';
          break;
        case 'facebook':
          albumURL = 'https://graph.facebook.com/' + pg.userId + '/albums?limit=' + pg.albumLimit + '&access_token=' + pg.accessToken + '&callback=?';
          break;
        case 'instagram':
          //we ain't got no albums in instagram
          albumURL = null;
          break;
        case 'local':
          // No album support yet, but url wont be needed anyway.
          albumURL = null;
          break;

        default:
          throw('Please define a gallery type.');
        }

        $.getJSON(albumURL,function(json) {
          pg.parseAlbumData(json);
        });
      },


      /*--------------------------

        Load all albums to the page

      ----------------------------*/
      loadAlbums: function(galleryTitle,galleryImage,galleryJSON) {
        var displayAlbum = true;
        var imgHTML;

        //exclude albums if pg.exclude is set
        if(pg.exclude !== null) {
          $.each(pg.exclude,function(index, value){ //exclude albums if pg.exclude is set
            if(galleryJSON.indexOf(value) > 0){
              displayAlbum = false;
            }
          });
        }


        //include only specified albums if pg.include is set
        if(pg.include !== null) {
          displayAlbum = false;
          $.each(pg.include,function(index, value){ //exclude albums if pg.exclude is set
            if(galleryJSON.indexOf(value) > 0){
              displayAlbum = true;
            }
          });
        }


        if (displayAlbum){
          if (pg.type == 'facebook' || pg.type == 'flickr') {
            imgHTML = '<img src="'+ pg.imagePath + '/square.png" style="background-image: url(' + galleryImage + ');" title="' + galleryTitle + '" title="' + galleryTitle + '" class="pgalbumimg">';
          }
          else {
            imgHTML = '<img src="' + galleryImage + '" title="' + galleryTitle + '" title="' + galleryTitle + '" class="pgalbumimg">';
          }

          if(pg.type == 'local') {
            $('#pgalbums').append(
              '<li class="pgalbumthumb">' +
                '<a href="#" data-album-index="' + galleryJSON + '" class="pgalbumlink">' + imgHTML + '<span class="pgalbumtitle">' + galleryTitle + '</span><span class="pgplus">+</span></a>' +
              '</li>'
            );
          } else {
            $('#pgalbums').append(
              '<li class="pgalbumthumb">' +
                '<a href="' + galleryJSON + '" class="pgalbumlink">' + imgHTML + '<span class="pgalbumtitle">' + galleryTitle + '</span><span class="pgplus">+</span></a>' +
              '</li>'
            );
          }
        }




      }, //End loadAlbums


      /*--------------------------

        Load all the images within
        a specific gallery

      ----------------------------*/
      loadSingleAlbum:function(){
        var url;
        switch(pg.type)
        {
        case 'google':
          url = 'https://picasaweb.google.com/data/feed/base/user/' + pg.userId + '/albumid/' + pg.albumId + '?alt=json&hl=en_US';
          pg.loadGallery(url);
          break;
        case 'flickr':
          url = 'https://api.flickr.com/services/rest/?&method=flickr.photosets.getPhotos&api_key=' + pg.apiKey + '&photoset_id=' + pg.albumId + '=&format=json&jsoncallback=?';
          pg.loadGallery(url);
          break;
        case 'facebook':
          url = 'https://graph.facebook.com/' + pg.albumId + '/photos?limit=' + pg.limit + '&access_token=' + pg.accessToken;
          pg.loadGallery(url);
          break;
        case 'instagram':
          url = 'https://api.instagram.com/v1/users/' + pg.userId + '/media/recent/?access_token=' + pg.accessToken + '&count=' + pg.limit;
          pg.loadGallery(url);
          break;
        case 'local':
          pg.parseData(pg.imageData);
          break;
        }

        lmnt.addClass('loaded');
        $('#pgthumbhome').hide();

      },

      /*--------------------------

        Load all the images within
        a specific gallery

      ----------------------------*/
      loadGallery: function(url,title){
        pg.imgArray = [];
        pg.titleArray = [];
        $('#pgzoom').empty();
        $.ajax({
          url: url,
          cache: false,
          dataType: "jsonp",
          success: function(json){
            pg.parseData(json,title);
          }, //end success
          error: function(jqXHR, textStatus, errorThrown){
            console.log('Error: \njqXHR:' + jqXHR + '\ntextStatus: ' + textStatus + '\nerrorThrown: '  + errorThrown);
          }
        });
      }, //End loadGallery

    /*--------------------------

     Get background image of an element

     ----------------------------*/
      getBgUrl : function (el) {
          var bg = "";
          if (el.currentStyle) { // IE
              bg = el.currentStyle.backgroundImage;
          } else if (document.defaultView && document.defaultView.getComputedStyle) { // Firefox
              bg = document.defaultView.getComputedStyle(el, "").backgroundImage;
          } else { // try and get inline style
              bg = el.style.backgroundImage;
          }
          return bg.replace(/url\(['"]?(.*?)['"]?\)/i, "$1");
      },//End getBgUrl

      /*--------------------------

        Parse and convert the data
        of the gallery

      ----------------------------*/
      parseData: function(json,title){
        var obPath,
            imgTitle,
            imgSrc,
            imgTh,
            imgBg = '',
            thumbsLoaded = 0,
            zoomWidth,
            flickrImgExt;

        $('.crumbtitle').remove();
        $('#pgthumbs').empty();
        if(title === undefined){
          title = '&nbsp;';
        }
        $('#pgthumbcrumbs').append('<li class="crumbtitle">' + title + '</li>');

        switch(pg.type)
        {
        case 'google':
          objPath = json.feed.entry;
          break;
        case 'flickr':
          objPath = json.photoset.photo;
          break;
        case 'facebook':
          objPath = json.data;
          break;
        case 'instagram':
          objPath = json.data;
          break;
        case 'local':
          objPath = json.images;
          break;
        }

        pg.imgTotal = objPath.length;
        //limit the results
        if(pg.limit < pg.imgTotal){
          pg.imgTotal = pg.limit;
        }

        if(pg.imgTotal === 0) {
          throw('Please check your photo permissions,\nor make sure there are photos in this gallery.');
        }

        if(pg.winWidth > 1100) {
          zoomWidth = 1024;
          flickrImgExt = '_b';
        } else if(pg.winWidth > 620) {
          zoomWidth = 768;
          flickrImgExt = '_b';
        } else {
          zoomWidth = 540;
          flickrImgExt = '_z';
        }

        $.each(objPath,function(i,obj){
          //limit the results
          if(i < pg.limit) {
            switch(pg.type)
            {
            case 'google':
              imgTitle = obj.title.$t;
              imgSrc = obj.media$group.media$content[0].url;
              var lastSlash = imgSrc.lastIndexOf('/');
              var imgSrcSubString =imgSrc.substring(lastSlash);

              //show the max width image 1024 in this case
              imgSrc = imgSrc.replace(imgSrcSubString, '/s' + zoomWidth + imgSrcSubString);

              imgTh = obj.media$group.media$thumbnail[1].url;
              imgTh = imgTh.replace('s144','s160-c');
              break;
            case 'flickr':
              imgTitle = obj.title;
              imgSrc = 'http://farm' + obj.farm + '.staticflickr.com/' + obj.server + '/' + obj.id + '_' + obj.secret + flickrImgExt + '.jpg';
              imgTh = 'http://farm' + obj.farm + '.staticflickr.com/' + obj.server + '/' + obj.id + '_' + obj.secret + '_q.jpg';
              break;
            case 'facebook':
              imgTitle = obj.name;
              imgSrc = obj.images[1].source;
              imgTh = pg.imagePath + '/square.png';
              imgBg = ' style="background: url(' + obj.images[3].source + ') no-repeat 50% 50%; background-size: cover;"';
              break;
            case 'instagram':
              if(obj.caption !== null){
                imgTitle = obj.caption.text;
              }
              imgSrc = obj.images.standard_resolution.url;
              imgTh = obj.images.low_resolution.url;
              break;
            case 'local':
              if(obj.caption !== null){
                imgTitle = obj.caption;
              }
              imgSrc = obj.src;
              imgTh = obj.th;
              break;
            }

            if(!imgTitle) {
              imgTitle = '';
            }

            pg.imgArray[i] = imgSrc;
            pg.titleArray[i] = imgTitle;

            var $timer = '<time class="thumb-date">26 September 2014</time>';
            var $follow = '<ul class="thumb-follow"><li class="stat-likes"><i class="fa fa-heart"></i> &nbsp; <b>0</b></li><li class="stat-comments"><i class="fa fa-comment"></i> &nbsp; <b>0</b></li></ul>';
            var $thumbHTML = '<li class="pgthumb"><div class="wrapper-thumb">'+$timer+'<div class="bg"><div></div></div><a href="' + imgSrc + '"><div id="pgthumbimg'+i+'" style="background-image: url('+imgTh+');"></div></a>'+$follow+'</div></li>';
            $('#pgthumbs').append($thumbHTML);

            //check to make sure all the images are loaded and if so show the thumbs
            var image = document.createElement('img');
            image.src = pg.getBgUrl(document.getElementById('pgthumbimg'+i));
            image.onload = function () {
              thumbsLoaded++;
              if(thumbsLoaded == pg.imgTotal) {
                  $('#pgalbums').slideFade(700,function(){
                      $('.pgalbumthumb .pgloading').remove();
                  });
                  $('#pgthumbview').slideFade(700);
              }
            };
          } //end if(i < pg.limit)
        }); //end each
      },

      zoomIdx: null, //the zoom index
      zoomImagesLoaded: [],
      zoomScrollDir: null,
      zoomScrollLeft: 0,
      loadZoom: function(idx){
        pg.zoomIdx = idx;
        pg.winWidth = $(window).width();
        var pgZoomView = $('#pgzoomview'),
            pgZoomScroll = $('#pgzoomscroll'),
            pgPrevious = $('#pgprevious'),
            pgNext = $('#pgnext'),
            pgZoom = $('#pgzoom'),
            pgZoomHTML = '',
            totalImages = pg.imgArray.length;
        pgZoomView.addClass('fixed');
        pg.lockScroll();

        //show/hide the prev/next links
        if(idx === 0) {
          pgPrevious.hide();
        }

        if(idx == totalImages - 1) {
          pgNext.hide();
        }

        var pgzoomWidth = pg.imgArray.length * pg.winWidth;
        $('#pgzoom').width(pgzoomWidth);

        var scrollLeftInt = parseInt(idx * pg.winWidth);


        pgZoomView.fadeIn(function(){
          //this has gotta come in after the fade or iOS blows up.

          $(window).on('resize',pg.resizeZoom);

          $.each(pg.imgArray,function(i){
            var contentZoom = '<div class="wrapper-zoom">';
                contentZoom += '<div class="image-zoom"></div>';
                contentZoom += '<div class="comment-zoom">';
                contentZoom += '<div class="header-comment"><div class="image-comment"></div><div class="owner-comment"><a href="#">phongnguyenkim91</a><span class="timestamp">6 days ago</span><span>Hello</span></div></div>';
                contentZoom += '<div class="content-comment">adssad</div>';
                contentZoom += '<div class="footer-comment"></div></div>';
                contentZoom += '<div class="clear"></div></div>';
                pgZoomHTML = pgZoomHTML  + '<li class="pgzoomslide loading" id="pgzoomslide' + i + '" style="width: ' + pg.winWidth + 'px;">'+contentZoom+'<span class="pgzoomcaption">' + pg.titleArray[i] + '</span></li>';

            if(i + 1 == pg.imgArray.length) {
              //at the end of the loop
                $('#pgzoom').html(pgZoomHTML);

                pg.zoomKeyPress();
                $('#pgzoomscroll').scrollLeft(scrollLeftInt);
                pg.zoomScrollLeft = scrollLeftInt;
                pg.loadZoomImg(idx);
                pg.zoomScroll();
                //load siblings
                if((idx - 1) >= 0){
                pg.loadZoomImg(idx - 1);
                }

                if((idx + 1) < pg.imgArray.length){
                  pg.loadZoomImg(idx + 1);
                }
              }
            });
          });
      },

      lockScroll:  function(){
          $html = $('html');
          $body = $('body');
          var initWidth = $body.outerWidth();
          var initHeight = $body.outerHeight();

          var scrollPosition = [
              self.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
              self.pageYOffset || document.documentElement.scrollTop  || document.body.scrollTop
          ];
          $html.data('scroll-position', scrollPosition);
          $html.data('previous-overflow', $html.css('overflow'));
          $html.css('overflow', 'hidden');
          window.scrollTo(scrollPosition[0], scrollPosition[1]);

          var marginR = $body.outerWidth()-initWidth;
          var marginB = $body.outerHeight()-initHeight;
          $body.css({'margin-right': marginR,'margin-bottom': marginB});
      },

      unlockScroll: function(){
          $html = $('html');
          $body = $('body');
          $html.css('overflow', $html.data('previous-overflow'));
          var scrollPosition = $html.data('scroll-position');
          window.scrollTo(scrollPosition[0], scrollPosition[1]);

          $body.css({'margin-right': 0, 'margin-bottom': 0});
      },

      loadZoomImg:function(idx){
        if($('#pgzoomimg' + idx).length === 0){
          $('#pgzoomslide' + idx + ' .wrapper-zoom .image-zoom').html('<img src="' + pg.imgArray[idx] + '" data-src="' + pg.imgArray[idx] + '" title="' + pg.titleArray[idx] + '" alt="' + pg.titleArray[idx] + '" id="pgzoomimg' + idx + '" class="pgzoomimg">');
          $('#pgzoomimg' + idx).load(function(){
            $(this).addClass('active');
          });
        }
      },

      zoomScroll:function(){
        var pgPrevious = $('#pgprevious'),
            pgNext = $('#pgnext'),
            scrollTimeout,
            canLoadZoom = true;


        $('#pgzoomscroll').on('scroll',function(){
          currentScrollLeft = $(this).scrollLeft();
          if(canLoadZoom === true) {
            canLoadZoom = false;
            scrollTimeout = setTimeout(function(){
              if(currentScrollLeft === 0){
                pgPrevious.fadeOut();
              }
              else {
                pgPrevious.fadeIn();
              }

              if(currentScrollLeft >= (pg.imgTotal - 1) * pg.winWidth){
              pgNext.fadeOut();
              }
              else {
                pgNext.fadeIn();
              }

              /*Check if we have scrolled left and if so load up the zoom image*/
              if(currentScrollLeft % pg.zoomScrollLeft > 20 || (currentScrollLeft > 0 && pg.zoomScrollLeft === 0)){
                pg.zoomScrollLeft = currentScrollLeft;
                var currentIdx = pg.zoomScrollLeft / pg.winWidth;

                var currentIdxCeil = Math.ceil(currentIdx);
                var currentIdxFloor = Math.floor(currentIdx);

                //Lazy load siblings on scroll.
                if(!pg.zoomImagesLoaded[currentIdxCeil]) {
                  pg.loadZoomImg(currentIdxCeil);
                }
                if(!pg.zoomImagesLoaded[currentIdxFloor]){
                  pg.loadZoomImg(currentIdxFloor);
                }
              }
              canLoadZoom = true;
            },200);
          }
        });
      },

      zoomKeyPress: function(){
        $(document).on('keyup','body',function(e){
          if(e.which == 27){
            pg.unloadZoom();
          }
          else
          if(e.which == 37){
            pg.prevNext('previous');
          }
          else
          if(e.which == 39){
            pg.prevNext('next');
          }
        });
      },

      resizeZoom: function(){
        pg.winWidth = $(window).width();
        var pgzoomWidth = pg.imgArray.length * pg.winWidth;
        $('#pgzoom').width(pgzoomWidth);
        $('.pgzoomslide').width(pg.winWidth);

        var scrollLeftInt = parseInt(pg.zoomIdx * pg.winWidth);

        $('#pgzoomscroll').scrollLeft(scrollLeftInt);
      },

      unloadZoom: function(){
        $(document).off('keyup','body');
        $(window).off('resize',pg.resizeZoom);
        $('#pgzoomscroll').off('scroll');
        $('#pgzoomview').fadeOut(function(){
          $('#pgzoom').empty();
          $('#pgzoomview').off('keyup');
          $('#pgzoomview').removeClass('fixed');
          pg.unlockScroll();
        });

      },

      prevNext: function(dir){
        var currentIdx = $('#pgzoomscroll').scrollLeft() / pg.winWidth;

        if(dir == "previous"){
          pg.zoomIdx = Math.round(currentIdx)  - 1;
        }
        else {
          pg.zoomIdx = Math.round(currentIdx) + 1;
        }

        var newScrollLeft = pg.zoomIdx * pg.winWidth;

        $('#pgzoomscroll').stop().animate({scrollLeft:newScrollLeft});
      }
    };

    $.extend(pg, options);
    pg.init();
  };
})( jQuery );