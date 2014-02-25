Layout = UI.Component.extend({
  init: function () {
    //XXX we shouldn't have to define all of these methods inside the init
    //    function. Meteor should implement proper OO so we can just add these
    //    methods to the prototype of Layout like regular JavaScript OO. In the
    //    current paradigm, no one can inherit from Layout and override these
    //    methods. They're effectively all private until instance time.

    var layout = this;
    var tmpl = this.get('template');
    var tmplDep = new Deps.Dependency;
    var data = this.get();
    var dataDep = new Deps.Dependency;
    var regions = this._regions = new ReactiveDict;
    var content = this.__content;

    // the default main region will be the content block
    // for this component. example:
    //  {{#Layout template="MyLayout"}}
    //    Content block in here becomes main region
    //  {{/Layout}}
    regions.set('main', '_defaultMainRegion');

    /**
    * instance methods
    */

    this.template = function (value) {
      if (value && value != tmpl) {
        tmpl = value;
        tmplDep.changed();
      } else {
        tmplDep.depend();
        return tmpl || '_defaultLayout';
      }
    };

    this.data = function (value) {
      if (value && !EJSON.equals(value, data)) {
        data = value;
        dataDep.changed();
      } else {
        dataDep.depend();
        return data;
      }
    };

    /**
     * Set a region template.
     *
     * If you want to get the template for a region
     * you need to call this._regions.get('key');
     *
     */
    this.setRegion = function (key, value) {
      if (arguments.length < 2) {
        value = key;
        key = 'main';
      }

      regions.set(key, value);
    };

    //TODO add test
    this.getRegionKeys = function () {
      return _.keys(region.keys);
    };

    //TODO add test
    this.clearRegion = function (key) {
      regions.set(key, null);
    };

    this.yield = UI.Component.extend({
      init: function () {
        var data = this.get();
        this.region = data && data.region || 'main';
      },

      render: function () {
        var self = this;
        var region = self.region;
        var regions = self.lookup('_regions');

        // returning a function tells UI.materialize to
        // create a computation. then, if the region template
        // changes, this comp will be rerun and the new template
        // will get put on the screen.
        return function () {
          var tmpl = regions.get(region);
          if (tmpl) {
            return UI.With(function () {
              return layout.data();
            }, UI.block(function () {
              return Spacebars.include(self.lookupTemplate(tmpl));
            }));
          }
        };
      }
    });

    /**
     * By default the main region will be the content block
     * if the layout was used directly in your template like this:
     *
     *  {{#Layout}}
     *    content block goes into main {{> yield}}
     *  {{/Layout}}
     */
    this._defaultMainRegion = function () {
      return content || null;
    };

    this._defaultLayout = function () {
      return UI.block(function () {
        return Spacebars.include(this.lookupTemplate('yield'));
      });
    };
  },

  render: function () {
    var self = this;

    // return a function to create a reactive
    // computation. so if the template changes
    // the layout is re-endered.
    return function () {
      return self.lookupTemplate(self.template());
    };
  }
});

/**
 * Put Layout into the template lookup chain so
 * we can do this:
 * {{#Layout template="MyLayout"}}
 *  Some content
 * {{/Layout}}
 */
Template.Layout = Layout;

BlazeUIManager = function (router) {
  var self = this;
  this.router = router;
  this.layout = null;

  _.each(['setRegion', 'clearRegion', 'template', 'data'], function (method) {
    self[method] = function () {
      if (self.layout) {
        return self.layout[method].apply(this, arguments);
      }
    };
  });
};

BlazeUIManager.prototype = {
  render: function (props) {
    this.layout = UI.render(Layout.extend(props || {}));
    return this.layout;
  },

  insert: function (parent) {
    UI.DomRange.insert(this.render().dom, parent || document.body);
  }
};

if (Package['iron-router']) {
  Router.setUIManager(function (router) {
    return new BlazeUIManager(router);
  });
}
