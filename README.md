# jsConfig

Simple javascript library to manage frontend application configuration.

## Features

- Supported settings types: text, numeric, boolean, enumeration (list of allowed values)
- Each setting has:
  - A name
  - A type, with associated allowed values
  - A default/initial value
  - An optional textual description, for HTML rendering
  - An optional HTML class name, for HTML rendering
- Automatically generates an HTML table to visualize or edit the configuration
- Configurable event listener to be notified when configuration was changed in HTML table
- Versioning to automatically reset defaults when a new version is published

# Examples

## Initialization

Create a configuration object with 3 settings of type boolean, enumeration (list), text and numerical. Persist it in browser's `localStorage`, setting version to `2` so that it overwrites previous settings with version `1`.

```javascript
let cfg = new JsConfig({autosave: true, version: 2})
  .add("setting1", JsConfig.boolType(), false, "Activate debug features")
  .add("countdown", JsConfig.listType("graphic", "txt"), "graphic", "alternative UIs for countdowns")
  .add("style", JsConfig.listMultiType("bold", "italic", "subscript", "superscript"), ["bold", "italic"], "text style")
  .add("mobLink", JsConfig.textType(".*"), "https://idcfido.demo.gemalto.com/enroll?token=*REGCODE*", "URL to trigger app with registration link")
  .add("authenticationTimeout", JsConfig.numType(0, 3600, 10), 120, "Number of seconds before FIDO authentication times out")
  .onChange(cfg => localStorage.setItem("my_app_config", JSON.stringify(cfg)))
  .setConfig(localStorage.getItem("my_app_config"));
```

## Display configuration

Display the configuration into a HTML `<table>` element (no styling):

```HTML
<table id="config"></table>
```
Editable configuration:
```javascript
  cfg.showConfigTable(document.geElementById("config"));
```
Read-only configuration:
```javascript
  cfg.showConfigTable(document.geElementById("config"), true);
```

## Read configuration

Reads the configuration from an editable configuration table and store it into the configuration object.

```javascript
cfg.readConfigTable(document.geElementById("config"));
```
## Reset configuration

Resets the configuration object to default values.

```javascript
    jsc.resetToDefault();
```

# API documentation

[jsConfig](https://opotonniee.github.io/js-config/doc/JsConfig.html)
