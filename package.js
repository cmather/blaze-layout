Package.describe({
  summary: 'A Blaze powered layout component for dynamic rendering.'
});

Package.on_use(function (api) {
  api.use('iron-router', 'client', {weak: true});
  api.use('templating');
  api.use('ui');
  api.use('reactive-dict');
  api.use('underscore');

  api.add_files('layout.js', 'client');
  api.add_files('overrides.js', 'client');
  api.export('Layout', 'client');
});

Package.on_test(function (api) {
  api.use('tinytest', 'client');
  api.use('test-helpers', 'client');
  api.use('blaze-layout');
  api.use('templating');
  api.add_files('layout-test.html', 'client');
  api.add_files('layout-test.js', 'client');
});
