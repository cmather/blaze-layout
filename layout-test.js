String.prototype.compact = function () {
  return this.trim().replace(/\s/g, '').replace(/\n/g, '');
};

var renderComponent = function (cmp, parent, props) {
  var inst = UI.render(cmp.extend(props || {}));
  UI.DomRange.insert(inst.dom, parent);
  return inst;
};

var renderLayout = function (parent, props) {
  return renderComponent(Layout, parent, props);
};

var withRenderedComponent = function (cmp, props, cb) {
  if (arguments.length < 3) {
    cb = props;
    props = {};
  }

  var screen = document.createElement('div');
  document.body.appendChild(screen);
  var inst = renderComponent(cmp, screen, props);

  try {
    cb(inst, screen);
  } finally {
    document.body.removeChild(screen);
  }
};

var withRenderedLayout = function (props, cb) {
  if (arguments.length < 2) {
    cb = props;
    props = {};
  }

  var screen = document.createElement('div');
  document.body.appendChild(screen);
  var inst = renderLayout(screen, props);

  try {
    cb(inst, screen);
  } finally {
    document.body.removeChild(screen);
  }
};

Tinytest.add('layout - rendering dynamic templates', function (test) {
  withRenderedLayout({template: 'LayoutOne'}, function (layout, screen) {
    test.equal(screen.innerHTML.trim(), 'one', 'initial layout template not rendered');

    layout.template('LayoutTwo');
    Deps.flush();
    test.equal(screen.innerHTML.trim(), 'two', 'calling template method should change layout template');
  });
});

Tinytest.add('layout - setting undefined template', function (test) {
  withRenderedLayout({template: 'LayoutOne'}, function (layout, screen) {
    test.equal(screen.innerHTML.trim(), 'one', 'initial layout template not rendered');
    layout.template(undefined);
    Deps.flush();
    test.equal(screen.innerHTML.trim(), '', 'Should use default layout');
  });
});

Tinytest.add('layout - dynamic data', function (test) {
  withRenderedLayout({template: 'LayoutWithData'}, function (layout, screen) {
    var renderCount = 1;

    layout.rendered = function () {
      renderCount++;
    };

    test.equal(renderCount, 1, 'layout should have only rendered once');
    test.equal(screen.innerHTML.trim(), 'layout', 'initial layout not rendered');

    layout.setData({title: 'test'});
    Deps.flush();
    test.equal(screen.innerHTML.trim(), 'layout test', 'layout data context not changed');

    test.equal(renderCount, 1, 'layout should have only rendered once');
  });
});

Tinytest.add('layout - yield into main region with default layout', function (test) {
  withRenderedLayout(function (layout, screen) {
    layout.setRegion('One'); 
    Deps.flush();
    test.equal(screen.innerHTML.trim(), 'one', 'could not render into main region with default layout');
  });
});

Tinytest.add('layout - default main region using Layout template', function (test) {
  withRenderedComponent(Template.DefaultMainRegion, function (cmp, screen) {
    test.equal(screen.innerHTML.trim(), 'ok', 'default main region should be __content');
  });
});

Tinytest.add('layout - dynamic yield regions', function (test) {
  withRenderedLayout({template: 'LayoutWithTwoYields'}, function (layout, screen) {
    var renderedCount = 1;
    layout.rendered = function () { renderedCount++; };

    var oneRenderCount = 0;
    Template.One.rendered = function () { oneRenderCount++; };

    layout.setRegion('One');
    Deps.flush();
    test.equal(screen.innerHTML.compact(), 'one', 'main region should be "one"');
    test.equal(oneRenderCount, 1, 'template should have been rendered into layout');

    // should be equivalent to above
    layout.setRegion('main', 'One');
    Deps.flush();
    test.equal(screen.innerHTML.compact(), 'one', 'main region should be "one"');
    test.equal(oneRenderCount, 1, 'template already rendered so should not be rendered again');

    layout.setRegion('footer', 'Two');
    Deps.flush();
    test.equal(screen.innerHTML.compact(), 'onetwo', 'both yield regions should have rendered');
  });
});

Tinytest.add('layout - contentFor helper', function (test) {
  withRenderedLayout({template: 'LayoutWithTwoYields'}, function (layout, screen) {
    layout.setRegion('ContentForTests');
    Deps.flush();
    test.equal(screen.innerHTML.compact(), 'mainfooter', 'contentFor helper should render into yield');
  });
});

Tinytest.add('layout - global layout data context', function (test) {
  withRenderedLayout({template: 'LayoutWithData'}, function (layout, screen) {
    var layoutRenderCount = 1;
    layout.rendered = function () { layoutRenderCount++; };
    test.equal(screen.innerHTML.compact(), 'layout');

    layout.setData({title:'1'});
    Deps.flush();
    test.equal(screen.innerHTML.compact(), 'layout1', 'data context should be set on layout');
    test.equal(layoutRenderCount, 1, 'layout should not re-render');

    layout.setData({title:'2'});
    Deps.flush();
    test.equal(screen.innerHTML.compact(), 'layout2', 'data context should be set on layout');
    test.equal(layoutRenderCount, 1, 'layout should not re-render');
  });
});

Tinytest.add('layout - data with yield regions', function (test) {
  withRenderedLayout({template: 'LayoutWithDataAndYields'}, function (layout, screen) {
    var layoutRenderCount = 1;
    layout.rendered = function () { layoutRenderCount++; };

    var childRenderCount = 0;
    var footerRenderCount = 0;
    Template.ChildWithData.rendered = function () { childRenderCount++; };
    Template.FooterWithData.rendered = function () { footerRenderCount++; };

    layout.setRegion('main', 'ChildWithData');
    layout.setRegion('footer', 'FooterWithData');
    Deps.flush();

    test.equal(childRenderCount, 1);
    test.equal(footerRenderCount, 1);
    test.equal(layoutRenderCount, 1);
    test.equal(screen.innerHTML.compact(), 'layoutchildfooter');

    layout.setData({title:'1'});
    Deps.flush();

    test.equal(childRenderCount, 1);
    test.equal(footerRenderCount, 1);
    test.equal(layoutRenderCount, 1);
    test.equal(screen.innerHTML.compact(), 'layout1child1footer1');

    layout.setData({title:'2'});
    Deps.flush();

    test.equal(childRenderCount, 1);
    test.equal(footerRenderCount, 1);
    test.equal(layoutRenderCount, 1);
    test.equal(screen.innerHTML.compact(), 'layout2child2footer2');
  });
});

Tinytest.add('layout - layout template not found in lookup', function (test) {
  var div = document.createElement('div');
  document.body.appendChild(div);

  try {
    var layout;

    test.throws(function () {
      layout = renderComponent(Layout, div, {
        template: 'SomeBogusTemplateThatDoesNotExist'
      });
    }, /BlazeLayout/); // this checks the error is a BlazeLayout error

  } finally {
    document.body.removeChild(div);
  }
});

Tinytest.add('layout - region templates not found in lookup', function (test) {
  var div = document.createElement('div');
  document.body.appendChild(div);

  try {
    var layout = renderComponent(Layout, div);

    test.throws(function () {
      layout.setRegion('SomeBogusTemplate');
      // _throwFirstError means it will actually throw
      // instead of just logging to the console
      Deps.flush({_throwFirstError: true});
    }, /BlazeLayout/);

  } finally {
    document.body.removeChild(div);
  }
});
