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

  var screen = new OnscreenDiv;
  var inst = renderComponent(cmp, screen.node(), props);

  try {
    cb(inst, screen);
  } finally {
    screen.kill();
  }
};

var withRenderedLayout = function (props, cb) {
  if (arguments.length < 2) {
    cb = props;
    props = {};
  }

  var screen = new OnscreenDiv;
  var inst = renderLayout(screen.node(), props);

  try {
    cb(inst, screen);
  } finally {
    screen.kill();
  }
};

Tinytest.add('layout - rendering dynamic templates', function (test) {
  withRenderedLayout({template: 'LayoutOne'}, function (layout, screen) {
    test.equal(screen.html().trim(), 'one', 'initial layout template not rendered');

    layout.template('LayoutTwo');
    Deps.flush();
    test.equal(screen.html().trim(), 'two', 'calling template method should change layout template');
  });
});

Tinytest.add('layout - dynamic data', function (test) {
  withRenderedLayout({template: 'LayoutWithData'}, function (layout, screen) {
    var renderCount = 1;

    layout.rendered = function () {
      renderCount++;
    };

    test.equal(renderCount, 1, 'layout should have only rendered once');
    test.equal(screen.html().trim(), 'layout', 'initial layout not rendered');

    layout.data({title: 'test'});
    Deps.flush();
    test.equal(screen.html().trim(), 'layout test', 'layout data context not changed');

    test.equal(renderCount, 1, 'layout should have only rendered once');
  });
});

Tinytest.add('layout - yield into main region with default layout', function (test) {
  withRenderedLayout(function (layout, screen) {
    layout.setRegion('One'); 
    Deps.flush();
    test.equal(screen.html().trim(), 'one', 'could not render into main region with default layout');
  });
});

Tinytest.add('layout - default main region using Layout template', function (test) {
  withRenderedComponent(Template.DefaultMainRegion, function (cmp, screen) {
    test.equal(screen.html().trim(), 'ok', 'default main region should be __content');
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
    test.equal(screen.text().compact(), 'one', 'main region should be "one"');
    test.equal(oneRenderCount, 1, 'template should have been rendered into layout');

    // should be equivalent to above
    layout.setRegion('main', 'One');
    Deps.flush();
    test.equal(screen.text().compact(), 'one', 'main region should be "one"');
    test.equal(oneRenderCount, 1, 'template already rendered so should not be rendered again');

    layout.setRegion('footer', 'Two');
    Deps.flush();
    test.equal(screen.text().compact(), 'onetwo', 'both yield regions should have rendered');
  });
});

Tinytest.add('layout - global layout data context', function (test) {
  withRenderedLayout({template: 'LayoutWithData'}, function (layout, screen) {
    var layoutRenderCount = 1;
    layout.rendered = function () { layoutRenderCount++; };
    test.equal(screen.html().compact(), 'layout');

    layout.data({title:'1'});
    Deps.flush();
    test.equal(screen.html().compact(), 'layout1', 'data context should be set on layout');
    test.equal(layoutRenderCount, 1, 'layout should not re-render');

    layout.data({title:'2'});
    Deps.flush();
    test.equal(screen.html().compact(), 'layout2', 'data context should be set on layout');
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
    test.equal(screen.text().compact(), 'layoutchildfooter');

    layout.data({title:'1'});
    Deps.flush();

    test.equal(childRenderCount, 1);
    test.equal(footerRenderCount, 1);
    test.equal(layoutRenderCount, 1);
    test.equal(screen.text().compact(), 'layout1child1footer1');

    layout.data({title:'2'});
    Deps.flush();

    test.equal(childRenderCount, 1);
    test.equal(footerRenderCount, 1);
    test.equal(layoutRenderCount, 1);
    test.equal(screen.text().compact(), 'layout2child2footer2');
  });
});
