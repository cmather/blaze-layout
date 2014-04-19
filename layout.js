//XXX Infinite loop issue in this circumstance:
// {{#Layout template="MyLayout"}}
//  {{> yield}}
// {{/Layout}}
// 
// because content does a yield lookup for the main region, which in turn
// yields, which results in a stack overflow.

var isLogging = false;

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
  var contentBlocksByRegion = self._contentBlocksByRegion;

  if (!name)
    throw new Error("BlazeLayout: You must pass a name to lookupTemplate");

  if (contentBlocksByRegion[name]) {
    result = contentBlocksByRegion[name];
  } else if ((comp = findComponentWithProp(name, self))) {
    result = comp[name];
  } else if (_.has(Template, name)) {
    result = Template[name];
  } else if (result = UI._globalHelper(name)) {}

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
  kind: 'Layout',

  init: function () {
    var self = this;

    var layout = this;

    var tmpl = Deps.nonreactive(function () {
      return self.get('template') || self.template || '_defaultLayout';
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

    /**
    * instance methods
    */

    this.template = function (value) {
      if (arguments.length > 0) {
        if (!value)
          value = '_defaultLayout';
        
        if (!EJSON.equals(value, tmpl)) {
          tmpl = value;
          tmplDep.changed();
        }
      } else {
        tmplDep.depend();
        return tmpl;
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
        var region;

        if (_.isString(data))
          region = data;
        else if (_.isObject(data))
          region = data.region || 'main';
        else
          region = 'main';

        self.region = region;

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
          var regions = layout._regions;
          // create a reactive dep
          var tmpl = regions.get(region);

          if (tmpl)
            return lookupTemplate.call(layout, tmpl);
          else if (region === 'main' && content) {
            return content;
          }
          else
            return null;
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

        var region;

        if (_.isString(data))
          region = data;
        else if (_.isObject(data))
          region = data.region;

        self.region = region;

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

      //XXX hack to make work with null/false values.
      //see this.template = in ctor function.
      if (tmplName === '_defaultLayout')
        return self._defaultLayout;
      else if (tmplName) {
        var tmpl = lookupTemplate.call(self, tmplName);
        // it's a component
        if (typeof tmpl.instantiate === 'function')
          // See how __pasthrough is used in overrides.js
          // findComponentWithHelper. If __passthrough is true
          // then we'll continue past this component in looking
          // up a helper method. This allows this use case:
          // <template name="SomeParent">
          //  {{#Layout template="SomeLayout"}}
          //    I want a helper method on SomeParent
          //    called {{someHelperMethod}}
          //  {{/Layout}}
          // </template>
          tmpl.__passthrough = true;
        return tmpl;
      }
      else {
        return self['yield'];
      }
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
      return self._component.template.apply(self, arguments);
    else
      throw new Error('Layout has not been rendered yet');
  };
};

BlazeUIManager.prototype = {
  render: function (props, parentComponent) {
    this._component = UI.render(Layout.extend(props || {}), parentComponent || UI.body);
    return this._component;
  },

  insert: function (parentDom, parentComponent, props) {
    UI.DomRange.insert(this.render(props, parentComponent).dom, parentDom || document.body);
  }
};
