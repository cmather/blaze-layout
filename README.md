A Meteor Blaze powered Layout component for dynamic rendering and data. Its major features are:

1. Dynamically set the layout template and data context.
2. Define yield regions to dynamically render templates into.
3. Never re-render templates unless they change

**NOTE: Requires shark branch of Meteor**

### Usage in Templates

```html
<body>
  {{#Layout template="MyLayout"}}
    This content will go into the main yield region.
    
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
The IronRouter blaze-integration branch has been enhanced to allow a pluggable
ui manager. This will allow users to use the old Shark ui manager, the
blaze-layout manager, or even another one entirely. If you add this package to
your project it will start working with IronRouter automatically.

### API Notes
The API contract between iron-router and any ui manager looks like this:

```javascript
LayoutManager.prototype = {
  data: function (value) { ... },
  setRegion: function (key, value) { ... },
  clearRegion: function (key) { ... },
  render: function () { ... },
  insert: function (parent) { ... },
  template: function (value) { ... }
};
```
