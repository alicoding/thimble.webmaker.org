define(['template!details-form', 'jquery', 'selectize', 'jquery-ui'], function (detailsFormHTML, $, selectize) {
  "use strict";

  var DEFAULT_THUMBNAIL = 'https://webmaker.org/img/thumbs/thimble-grey.png';
  var ALL_FIELDS = [
    'title',
    'thumbnail',
    'description',
    'tags',
    'locales',
    'published'
  ];

  var $container;
  var $thumbnailChoices;
  var codeMirror;
  var localePicker;

  // selector function for returning a form element
  function $input(name) {
    return $('[name="' + name + '"]', $container);
  }

  var DetailsForm = function (options) {
    var self = this;
    var defaults = {
      container: '.publish-panel',
      documentIframe: '.preview-holder iframe'
    };
    var option,
        tagInput,
        makeEndpoint = $('body').data('make-endpoint');

    for (option in options) {
      defaults[option] = options[option] || defaults[option];
    }

    options = defaults;

    $container = $(options.container);
    $container.html(detailsFormHTML());

    tagInput = $input('tag-input');

    codeMirror = options.codeMirror;
    $thumbnailChoices = $('.thumbnail-choices', $container);

    function blurCallback (e) {
      self.addTags(encodeURIComponent(tagInput.val()));
    }

    // Setup autocomplete widget
    tagInput.autocomplete({
      source: function( request, response ) {
        var term = request.term;
        $.getJSON( makeEndpoint + "/api/20130724/make/tags?t=" + term, function( data ) {
          response( data.tags.map(function( item ) {
            return item.term;
          }));
        });
      },
      minLength: 1,
      focus: function () {
        tagInput.off('blur', blurCallback);
      },
      close: function () {
        tagInput.on('blur', blurCallback);
      }
    });

    // Setup tag input/output event handlers
    tagInput.on('keydown', function (e) {
      if (e.which === 13 || e.which === 188) {
        e.preventDefault();
        // FIXME: https://bugzilla.mozilla.org/show_bug.cgi?id=922724
        // We encode user input tags because
        // currently tags with colons are stripped.
        // Tutorial urls contain a colon,
        // so in order to not have it stripped, we escape it.
        self.addTags(encodeURIComponent(this.value));
        tagInput.autocomplete('close');
        this.value = "";
      }
    });
    tagInput.on('blur', blurCallback);
    $input('tag-output').click(function (e) {
      if (e.target.tagName === 'LI') {
        var $target = $(e.target);
        var tag = $target.text();
        // Remove from tags array
        var i = self.tags.indexOf(tag);
        self.tags.splice(i, 1);
        $input('tags').val(self.tags.join(','));
        // Remove element
        $target.remove();
      }
    });
    $input('thumbnail').on('blur', function (e) {
      self.updateThumbnails(this.value);
    });

    // Store tags
    self.tags = [];

    // convert list
    localePicker = $('#locales').selectize()[0].selectize;
  };

  // construct a new document fragment for sandbox code evaluation
  // such as finding the document title, etc.
  DetailsForm.prototype.getCodeMirrorValue = function() {
    var sandbox = document.createDocumentFragment(),
        contentElement = document.createElement("body");
    contentElement.innerHTML = codeMirror.getValue();
    sandbox.appendChild(contentElement);
    return $(contentElement);
  };

  // Update thumbnail choices based on contents of documentIframe
  DetailsForm.prototype.updateThumbnails = function (selectedImg) {
    var self = this;
    var $currentHTML = self.getCodeMirrorValue();
    var imgs = [];

    // First add selected image, if it exists
    if (selectedImg) {
      imgs.push(selectedImg);
    }

    // Now find images from the document HTML
    var imgsFromDocument = $currentHTML.find('img').each(function (i, el) {
      if (el.src && imgs.indexOf(el.src) === -1) {
        imgs.push(el.src);
      }
    });
    // Finally, add the default thumbnail
    if (imgs.indexOf(DEFAULT_THUMBNAIL) === -1) {
      imgs.push(DEFAULT_THUMBNAIL);
    }

    $thumbnailChoices.empty();

    imgs.forEach(function (src, i) {
      var $img = $('<li></li>');
      $img.css('background-image', 'url(' + src + ')');
      $thumbnailChoices.append($img);
      $img.click(function () {
        $thumbnailChoices.find('.selected').removeClass('selected');
        $(this).addClass('selected');
        $input('thumbnail').val(src);
      });
      // Use first image as thumbnail by default
      if (i === 0) {
        $input('thumbnail').val(src);
        $img.addClass('selected');
      }
    });

  };

  // Find meta tags in HTML content. Returns an array of strings;
  DetailsForm.prototype.findMetaTagInfo = function (name) {
    var self = this;
    // Different syntax for author and description
    if (name !== 'description' & name !== 'author') {
      name = 'webmaker:' + name;
    }

    var $currentHTML = self.getCodeMirrorValue();
    var $tags = $currentHTML.find('meta[name="' + name + '"]');

    var content = [];

    $tags.each(function (i, el) {
      content.push(el.content);
    });

    return content;
  };

  DetailsForm.prototype.addTags = function (tags) {
    var self = this;
    if (!tags) {
      return;
    }
    if (typeof tags === 'string') {
      tags = tags.split(',');
    }
    tags.forEach(function (item) {
      var val = item.replace(/[,#\s]/g, '');
      if (val && self.tags.indexOf(val) === -1 && val.indexOf( ":" ) === -1 ) {
        self.tags.push(val);
        $input('tags').val(self.tags.join(','));
        // FIXME: https://bugzilla.mozilla.org/show_bug.cgi?id=922724
        // We decode any tags for now because
        // currently tags with colons are stripped.
        // So when we save a tag, we escape colons, so when we try to display it, unescape it.
        $input('tag-output').append($('<li>').text(decodeURIComponent(val)));
      }
    });
    $input('tag-input').val('');
  };

  DetailsForm.prototype.setLocale = function (locale) {
    localePicker.clear();
    localePicker.addItem(locale);
  };

  DetailsForm.prototype.setPublished = function (state) {
    state = state || false;
    if (typeof state === "string") {
      state = (state !== "false");
    }
    $input('published').attr('checked', state);
  };

  // Update a given field
  DetailsForm.prototype.setValue = function (field, val) {
    var self = this;
    var $fieldInput = $input(field);
    var currentVal = $fieldInput.val();

    switch (field) {
      case 'title':
        val = val || currentVal || self.getCodeMirrorValue().find('title').text();
        $fieldInput.val(val);
        break;
      case 'thumbnail':
        val = val || currentVal || self.findMetaTagInfo('thumbnail')[0];
        self.updateThumbnails(val);
        break;
      case 'tags':
        val = val || currentVal || self.findMetaTagInfo('tags');
        // FIXME: https://bugzilla.mozilla.org/show_bug.cgi?id=922724
        // We do not decode tags directly from the makeapi,
        // this means it was stored with a colon, and is created outside of thimble.
        self.addTags(val);
        break;
      case 'locales':
        val = val || currentVal || self.findMetaTagInfo('locale');
        self.setLocale(val);
        break;
      case 'published':
        self.setPublished(typeof val === "undefined" ? true : val);
        break;
      default:
        val = val || currentVal || self.findMetaTagInfo(field)[0];
        $fieldInput.val(val);
        break;
    }
  };

  // Update all fields with an object of make data
  DetailsForm.prototype.updateAll = function (data) {
    var self = this;
    data = data || {};
    ALL_FIELDS.forEach(function (field, i) {
      self.setValue(field, data[field]);
    });
  };

  // Return data for a field, or an object containing all metadata
  DetailsForm.prototype.getValue = function (field) {
    var self = this;
    var fields = field ? [field] : ALL_FIELDS;
    var obj = {};

    fields.forEach(function (item) {
      var input = $input(item);
      var element = input[0];
      var type = element.getAttribute("type") || "";
      // if we use val() for checkboxes, it'll generate "yes"/"no" instead of true/false
      var val = type === "checkbox" ? element.checked : input.val();
      obj[item] = val;
    });

    return obj;
  };

  return DetailsForm;
});
