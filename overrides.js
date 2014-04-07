// some temporary overrides of blaze which hopefully will be resolved in core soon.

findComponentWithProp = function (id, comp) {
  while (comp) {
    if (typeof comp[id] !== 'undefined')
      return comp;
    comp = comp.parent;
  }
  return null;
};

getComponentData = function (comp) {
  comp = findComponentWithProp('data', comp);
  return (comp ?
          (typeof comp.data === 'function' ?
           comp.data() : comp.data) :
          null);
};

var findComponentOfKind = function (kind, comp) {
  while (comp) {
    if (comp.kind === kind)
      return comp;
    comp = comp.parent;
  }
  return null;
};

// added a '__passthrough' property that allows helpers through
findComponentWithHelper = function (id, comp) {
  while (comp) {
    if (comp.__helperHost) {
      if (typeof comp[id] !== 'undefined')
        return comp;

      // if __pasthrough == true on the component we will continue
      // looking up the parent chain to find a component with the
      // property of <id>. Otherwise just halt right now and return null.
      else if (! comp.__passthrough)
        return null;
    }
    comp = comp.parent;
  }
  return null;
};

// Override {{> yield}} and {{#contentFor}} to find the closest
// enclosing layout
var origLookup = UI.Component.lookup;
UI.Component.lookup = function (id, opts) {
  var self = this;
  var comp, result;
  
  if (id === 'yield') {
    throw new Error("Sorry, would you mind using {{> yield}} instead of {{yield}}? It helps the Blaze engine.");
  } else if (id === 'contentFor') {
    var layout = findComponentOfKind('Layout', this);
    if (!layout)
      throw new Error("Couldn't find a Layout component in the rendered component tree");
    else {
      result = layout[id];
    }

  // found a property or method of a component
  // (`self` or one of its ancestors)
  } else if (! /^\./.test(id) && (comp = findComponentWithHelper(id, self))) {
    result = comp[id];
    
  } else {
    return origLookup.apply(this, arguments);
  }
  
  if (typeof result === 'function' && ! result._isEmboxedConstant) {
    // Wrap the function `result`, binding `this` to `getComponentData(self)`.
    // This creates a dependency when the result function is called.
    // Don't do this if the function is really just an emboxed constant.
    return function (/*arguments*/) {
      var data = getComponentData(self);
      return result.apply(data === null ? {} : data, arguments);
    };
  } else {
    return result;
  };
};

var origLookupTemplate = UI.Component.lookupTemplate;
UI.Component.lookupTemplate = function (id, opts) {
  if (id === 'yield') {
    var layout = findComponentOfKind('Layout', this);
    if (!layout)
      throw new Error("Couldn't find a Layout component in the rendered component tree");
    else {
      return layout[id];
    }
  } else {
    return origLookupTemplate.apply(this, arguments);
  }
};

if (Package['iron-router']) {
  Package['iron-router'].Router.configure({
    uiManager: new BlazeUIManager
  });
}
