var path = require('path'),
    sys = require('sys'),
    assert = require('assert'),
    events = require('events'),
    http = require('http'),
    fs = require('fs'),
    vows = require('vows'),
    revalidator = require('../lib/revalidator');

function clone(object) {
  return Object.keys(object).reduce(function (obj, k) {
    obj[k] = object[k];
    return obj;
  }, {});
};


function assertInvalid(res) {
  assert.isObject(res);
  assert.strictEqual(res.valid, false);
}

function assertValid(res) {
  assert.isObject(res);
  assert.strictEqual(res.valid, true);
}

function assertHasError(attr, field) {
  return function (res) {
    assert.notEqual(res.errors.length, 0);
    assert.ok(res.errors.some(function (e) {
      return e.attribute === attr && (field ? e.property === field : true);
    }));
  };
}

function assertValidates(passingValue, failingValue, attributes) {
  var schema = {
    name: 'Resource',
    properties: { field: {} }
  };
  var attr = Object.keys(attributes)[0];
  revalidator.mixin(schema.properties.field, attributes); 

  return {
    "when the object conforms": {
      topic: function () {
        return revalidator.validate({ field: passingValue }, schema);
      },
      "return an object with `valid` set to true": assertValid
    },
    "when the object does not conform": {
      topic: function () {
        return revalidator.validate({ field: failingValue }, schema);
      },
      "return an object with `valid` set to false": assertInvalid,
      "and an error concerning the attribute":      assertHasError(Object.keys(attributes)[0], 'field')
    }
  };
}

vows.describe('revalidator', {
  "Validating": {
    "with <type>:'string'":   assertValidates ('hello',   42,        { type: "string" }),
    "with <type>:'number'":   assertValidates (42,       'hello',    { type: "number" }),
    "with <type>:'integer'":  assertValidates (42,        42.5,      { type: "integer" }),
    "with <type>:'array'":    assertValidates ([4, 2],   'hi',       { type: "array" }),
    "with <type>:'object'":   assertValidates ({},        [],        { type: "object" }),
    "with <type>:'boolean'":  assertValidates (false,     42,        { type: "boolean" }),
    "with <type>:'null'":     assertValidates (null,      false,     { type: "null" }),
    "with <type>:'any'":      assertValidates (9,         undefined, { type: "any" }),
    "with <pattern>":         assertValidates ("kaboom", "42",       { pattern: /^[a-z]+$/ }),
    "with <maxLength>":       assertValidates ("boom",   "kaboom",   { maxLength: 4 }),
    "with <minLength>":       assertValidates ("kaboom", "boom",     { minLength: 6 }),
    "with <minimum>":         assertValidates ( 512,      43,        { minimum:   473 }),
    "with <maximum>":         assertValidates ( 512,      1949,      { maximum:   678 }),
    "with <maximum>":         assertValidates ( 512,      1949,      { maximum:   678 }),
    "with <divisibleBy>":     assertValidates ( 10,       9,         { divisibleBy: 5 }),
    "with <enum>":            assertValidates ("orange",  "cigar",   { enum: ["orange", "apple", "pear"] }),
    "with <requires>": {
      topic: {
        properties: { 
          town:    { optional: true, requires: "country" },
          country: { optional: true }
        }
      },
      "when the object conforms": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna", country: "moon" }, schema);
        },
        "return an object with `valid` set to true": assertValid
      },
      "when the object does not conform": {
        topic: function (schema) {
          return revalidator.validate({ town: "luna" }, schema);
        },
        "return an object with `valid` set to false": assertInvalid,
        "and an error concerning the attribute":      assertHasError('requires')
      }
    }
  }
}).addBatch({
  "A schema": {
    topic: {
      name: 'Article',
      properties: {
        title: {
          type: 'string',
          maxLength: 140,
          optional: true,
          conditions: {
            optional: function () {
              return !this.published;
            }
          }
        },
        date: { type: 'string', format: 'date' },
        body: { type: 'string' },
        tags: {
          type: 'array',
          items: {
            type: 'string',
            pattern: /[a-z ]+/
          }
        },
        author:    { type: 'string', pattern: /^[\w ]+$/i, optional: false },
        published: { type: 'boolean', 'default': false },
        category:  { type: 'string' }
      }
    },
    "and an object": {
      topic: {
        title:    'Gimme some Gurus',
        date:     new(Date)().toUTCString(),
        body:     "And I will pwn your codex.",
        tags:     ['energy drinks', 'code'],
        author:   'cloudhead',
        published: true,
        category: 'misc'
      },
      "can be validated with `revalidator.validate`": {
        "and if it conforms": {
          topic: function (object, schema) {
            return revalidator.validate(object, schema);
          },
          "return an object with the `valid` property set to true": assertValid, 
          "return an object with the `errors` property as an empty array": function (res) {
            assert.isArray(res.errors);
            assert.isEmpty(res.errors);
          }
        },
        "and if it has a missing non-optional property": {
          topic: function (object, schema) {
            object = clone(object);
            delete object.author;
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid,
          "and an error concerning the 'optional' attribute": assertHasError('optional')
        },
        "and if it didn't validate a pattern": {
          topic: function (object, schema) {
            object = clone(object);
            object.author = 'email@address.com';
            return revalidator.validate(object, schema);
          },
          "return an object with `valid` set to false":      assertInvalid,
          "and an error concerning the 'pattern' attribute": assertHasError('pattern')
        },
      }
    }
  }
}).export(module);