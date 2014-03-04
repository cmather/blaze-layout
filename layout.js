/*****************************************************************************/
/* Meteor Functions */
/* 
 * These are copied from Core because we need to throw an error at lookup time
 * if a template is not found. The Component.lookup method does not give us a
 * way to do that. We should construct a proper pull request and send to Meteor.
 * Probably the ability to pass a not found callback or something to the lookup
 * method as an option.
/*****************************************************************************/
var findComponentWithProp = function (id, comp) {
  while (comp) {
    if (typeof comp[id] !== 'undefined')
      return comp;
    comp = comp.parent;
  }
  return null;
};

var getComponentData = function (comp) {
  comp = findComponentWithProp('data', comp);
  return (comp ?
          (typeof comp.data === 'function' ?
           comp.data() : comp.data) :
          null);
};
/*****************************************************************************/
/* End Meteor Functions */
/*****************************************************************************/

/**
 * Find a template object.
 *
 * Similar to Component.lookupTemplate but allows us to throw an error if we
 * can't find the template. This is useful in debugging vs. silently failing.
 *
 */
var lookupTemplate = function (name) {
  // self should be an instance of Layout
  var self = this;
  var comp;
  var result;
  var contentBlocksByRegion = self.lookup('_contentBlocksByRegion') || {};

  if (!name)
    throw new Error("BlazeLayout: You must pass a name to lookupTemplate");

  if (contentBlocksByRegion[name]) {
    result = contentBlocksByRegion[name];
  } else if ((comp = findComponentWithProp(name, self))) {
    result = comp[name];
  } else if (_.has(Template, name)) {
    result = Template[name];
  } else if (Handlebars._globalHelpers[name]) {
    result = Handlebars._globalHelpers[name];
  }

  if (typeof result === 'function' && !result._isEmboxedConstant) {
    return function (/* args */ ) {
      var data = getComponentData(self);
      return result.apply(data, arguments);
    }
  } else if (result) {
    return result
  } else {
    throw new Error("BlazeLayout: Sorry, couldn't find a template named " + name + ". Are you sure you defined it?");
  }
}

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

    // a place to put content defined like this:
    // {{#contentFor region="footer"}}content{{/contentFor}}
    // this will be searched in the lookup chain.
    var contentBlocksByRegion = this._contentBlocksByRegion = {};


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
      if (typeof value !== 'undefined' && value != tmpl) {
        tmpl = value;
        tmplDep.changed();
      } else {
        tmplDep.depend();
        return tmpl || '_defaultLayout';
      }
    };

    this.data = function (value) {
      if (typeof value !== 'undefined' && !EJSON.equals(value, data)) {
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
      } else if (typeof key === 'undefined') {
        key = 'main';
      }

      regions.set(key, value);
    };

    //TODO add test
    this.getRegionKeys = function () {
      return _.keys(regions.keys);
    };

    //TODO add test
    this.clearRegion = function (key) {
      regions.set(key, null);
    };

    // define a yield region to render templates into
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
              return lookupTemplate.call(self, tmpl);
            }));
          }
        };
      }
    });

    // render content into a yield region using markup. when you call setRegion
    // manually, you specify a string, not a content block. And the
    // lookupTemplate method uses this string name to find the template. Since
    // contentFor creates anonymous content we need a way to add this into the
    // lookup chain. But then we need to destroy it if it's not used anymore.
    // not sure how to do this.
    this.contentFor = UI.Component.extend({
      init: function () {
        var data = this.get();
        var region = this.region = data && data.region;

        if (!region)
          throw new Error("{{#contentFor}} requires a region argument like this: {{#contentFor region='footer'}}");
      },

      render: function () {
        var self = this;
        var region = self.region;
        var contentBlocksByRegion = self.lookup('_contentBlocksByRegion');
        var setRegion = self.lookup('setRegion');

        if (contentBlocksByRegion[region]) {
          //XXX do we need to do anyting special here like destroy()?
          delete contentBlocksByRegion[region];
        }

        contentBlocksByRegion[region] = self.__content;

        // this will just set the region to itself but when the lookupTemplate
        // function searches it will check contentBlocksByRegion first, so we'll
        // find the content block there.
        setRegion(region, region);

        // don't render anything for now. let the yield template control this.
        return null;
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
      var tmplName = self.template();
      return lookupTemplate.call(self, tmplName);
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
  this._component = null;

  _.each(['setRegion', 'clearRegion', 'getRegionKeys', 'data'], function (method) {
    self[method] = function () {
      if (self._component) {
        return self._component[method].apply(this, arguments);
      }
    };
  });

  // proxy the "layout" method to the underlying component's
  // "template" method.
  self.layout = function () {
    if (self._component)
      return self._component.template.apply(this, arguments);
  };
};

BlazeUIManager.prototype = {
  render: function (props) {
    this._component = UI.render(Layout.extend(props || {}));
    return this._component;
  },

  insert: function (parent) {
    UI.DomRange.insert(this.render().dom, parent || document.body);
  }
};

if (Package['iron-router']) {
  Package['iron-router'].Router.configure({
    uiManager: new BlazeUIManager
  });
}
