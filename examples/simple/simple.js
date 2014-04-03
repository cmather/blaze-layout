if (Meteor.isClient) {
  Template.layout.layoutHelper = function() {
    return "This is your layout speaking"
  }
  
  Template.hello.helloHelper = function () {
    return "This is your template speaking";
  };
}
