var isLogging = true;

var log = function (msg) {
  if (!isLogging)
    return;

  if (arguments.length > 1)
    msg = _.toArray(arguments).join(' ');
  console.log('%c<BlazeLayout> ' + msg, 'color: green; font-weight: bold; font-size: 1.3em;');
};

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
 * Similar to Component.lookupTemplate with two differences:
 *
 * 1. Throw an error if we can't find the template. This is useful in debugging
 * vs. silently failing.
 *
 * 2. If the template is a property on the component, don't call
 * getComponentData(self), thereby creating an unnecessary data dependency. This
 * was initially causing problems with {{> yield}}
 */
var lookupTemplate = function (name) {
  // self should be an instance of Layout
  var self = this;
  var comp;
  var result;
  var contentBlocksByRegion = self.get('_contentBlocksByRegion');

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
      // modified from Core to call function in context of the
      // component, not a data context.
      return result.apply(self, arguments);
    }
  } else if (result) {
    return result
  } else {
    throw new Error("BlazeLayout: Sorry, couldn't find a template named " + name + ". Are you sure you defined it?");
  }
}

Layout = UI.Component.extend({
  init: function () {
    var self = this;

    var layout = this;

    var tmpl = Deps.nonreactive(function () {
      return self.get('template') || '_defaultLayout';
    });

    var tmplDep = new Deps.Dependency;

    // get the initial data value
    var data = Deps.nonreactive(function () { return self.get(); });
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
      if (typeof value !== 'undefined') {

        // make sure we convert false and null
        // values to the _defaultLayout so when
        // we compare to our existing template
        // we don't re-render the default layout
        // unnecessarily.
        if (value === false || value === null)
          value = '_defaultLayout';
        
        if (!EJSON.equals(value, tmpl)) {
          tmpl = value;
          tmplDep.changed();
        }
      } else {
        tmplDep.depend();
        return tmpl || '_defaultLayout';
      }
    };

    var emboxedData = UI.emboxValue(function () {
      log('return data()');
      dataDep.depend();
      return data;
    });

    this.setData = function (value) {
      log('setData', value);
      if (!EJSON.equals(value, data)) {
        data = value;
        dataDep.changed();
      }
    };

    this.getData = function () {
      return emboxedData();
    };

    this.data = function () {
      return self.getData();
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
        var self = this;

        var data = Deps.nonreactive(function () { return self.get(); });
        var region = self.region = (data && data.region) || 'main';

        // reset the data function to use the layout's
        // data
        this.data = function () {
          return layout.getData();
        };
      },

      render: function () {
        var self = this;
        var region = self.region;

        // returning a function tells UI.materialize to
        // create a computation. then, if the region template
        // changes, this comp will be rerun and the new template
        // will get put on the screen.
        return function () {
          var regions = Deps.nonreactive(function () {
            return self.get('_regions');
          });

          // create a reactive dep
          var tmpl = regions.get(region);

          // don't call lookup if tmpl is undefined
          if (tmpl) {
            return lookupTemplate.call(self, tmpl);
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
        var self = this;
        var data = Deps.nonreactive(function () { return self.get(); });
        var region = self.region = data.region;

        if (!region)
          throw new Error("{{#contentFor}} requires a region argument like this: {{#contentFor region='footer'}}");
      },

      render: function () {
        var self = this;
        var region = self.region;

        var contentBlocksByRegion = layout._contentBlocksByRegion;

        if (contentBlocksByRegion[region]) {
          delete contentBlocksByRegion[region];
        }

        // store away the content block so we can find it during lookup
        // which happens in the yield function.
        contentBlocksByRegion[region] = self.__content;

        // this will just set the region to itself but when the lookupTemplate
        // function searches it will check contentBlocksByRegion first, so we'll
        // find the content block there.
        layout.setRegion(region, region);

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
        return lookupTemplate.call(layout, 'yield');
      });
    };
  },

  render: function () {
    var self = this;
    // return a function to create a reactive
    // computation. so if the template changes
    // the layout is re-endered.
    return function () {
      // reactive
      var tmplName = self.template();

      var tmpl = Deps.nonreactive(function () {
        return lookupTemplate.call(self, tmplName);
      });

      log('rendering layout: ' + tmplName);
      return tmpl;
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

  _.each([
    'setRegion',
    'clearRegion',
    'getRegionKeys',
    'getData',
    'setData'
  ], function (method) {
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
    else
      throw new Error('Layout has not been rendered yet');
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
