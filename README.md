A Meteor Blaze powered Layout component for dynamic rendering and data. Its major features are:

1. Dynamically set the layout template and data context.
2. Define yield regions to dynamically render templates into.
3. Never re-render templates if it doesn't have to.

### Usage in Templates

```html
<body>
  {{#Layout template="MyLayout"}}
    This content will go into the main yield region.
    
    The contentFor helper hasn't been implemented quite 
    yet so you can only set a region programmatically for now.
    
    {{#contentFor region="footer"}}
      This is some footer content
    {{/contentFor}}
  {{/Layout}}
</body>

<template name="MyLayout">
  <h1>My Layout</h1>
  
  <div>
    {{> yield}}
  </div>
  
  <footer>
    {{> yield region="footer"}}
  </footer>
</template>
```

### Usage as a Component

```javascript
var layout = UI.render(Layout.extend({template: 'MyLayout'});
UI.DomRange.insert(layout.dom, document.body);

// set the layout template
layout.template('AnotherLayoutTemplate');

// set the layout data context
layout.data({title: 'Some data context'});

// render a template into the main region {{> yield}}
layout.setRegion('SomeTemplateName');

// render a template into a named region
layout.setRegion('footer', 'SomeFooterTemplate');

```

### Integration with IronRouter
IronRouter is currently being enhanced to enable a pluggable layout manager. This will allow users to use the old Shark layout manager, the new blaze-layout component, or even another package entirely. The API is in flux. But, if the iron-router package is defined, the blaze-layout package will register its own LayoutManager with IronRouter like this:

```javascript
  Router.setLayoutManager(function () {
    return new LayoutManager;
  });
```

This will return a LayoutManager object that uses the Layout component under the hood. But the LayoutManager implements the API required by IronRouter. Specifically, the API looks like this:

```javascript
LayoutManager.prototype = {
  data: function (value) { ... },
  setRegion: function (key, value) { ... },
  render: function () { ... },
  insert: function (parent) { ... },
  template: function (value) { ... }
};
```

