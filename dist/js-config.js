"use strict";

/**
 * JSConfig is a Javascript class to manage preferences or config entries in the form of <name, value> pairs
 */
class JsConfig {

  // Assuming some browsers still do not have private and static fields

  // config field types
  static get #TYPE_BOOL() { return 0; }
  static get #TYPE_TEXT() { return 1; }
  static get #TYPE_NUM() { return 2; }
  static get #TYPE_LIST() { return 3; }
  
  static #isNum(value) { return typeof value === 'number'; }

  /**
   * Build a JsConfig object.
   * @param {*} settings - Optional object with optional settings:<br>
   *  - listener {function} - callback when config is updated through the UI
   *  - autoSave {boolean} - Automatically save UI changes<br>
   *  - capitalize {boolean} - Capitalize 1st letter of setting name in table
   *  - version {integer} - config compatible version. See {@link JsConfig#setConfig}
   */
  constructor(settings) {
    // The config data object. Use `new JsConfig()._` to access it
    this._ = {};
    // Private field holding the config entries's description
    this._desc = {};
    this._options = settings;
    this._._version = settings?.version;
  }

  /**
   * Declares an additional config entry, setting initial/default values.
   * Triggers the change listener invocation.
   *
   * @param {string} name - Name of the config item
   * @param {object} typeDesc - Type of the config value, as returned by
   *                     boolType(), textType(), numType(), listType(), or listMultiType()
   * @param {boolean|string|number} defaultValue - Default config value
   * @param {string} [readableDesc] - Description for this config entry, will be displayed as a tooltip
   * @param {string} [rowClass] - HTML class of the table row for this config
   * @returns this
   */
  add(name, typeDesc, defaultValue, readableDesc, rowClass) {
    this._desc[name] = {
      typeDesc: typeDesc,
      defaultValue: defaultValue,
      readableDesc: readableDesc,
      rowClass: rowClass
    };
    this._[name] = defaultValue;
    // notify changes
    this.change();
    return this;
  }

  /**
   * Creates a boolean type description
   *
   * @returns the created boolean type description
   */
  static boolType() {
    return {
      type: JsConfig.#TYPE_BOOL
    };
  }

  /**
   * Creates a text type description
   *
   * @param {string} [pattern] - regexp pattern the value should match
   * @returns the created text type description
   */
  static textType(pattern) {
    return {
      type: JsConfig.#TYPE_TEXT,
      pattern: pattern
    };
  }

  /**
   * Creates an list type description. 
   * Selected configuration must be exactly one value of the listed values.
   *
   * @param  {...any} values - list of possible string values
   * @returns the created list type description
   */
  static listType(...values) {
    return {
      type: JsConfig.#TYPE_LIST,
      values: values
    };
  }

  /**
   * Creates a multi-list type description
   * Selected configuration can be 0 to N values of the listed values.
   *
   * @param  {string[]} values - list of possible string values
   * @param  {number} [min] - minimum number of configured values
   * @param  {number} [max] - maximum number of configured values
   * @returns the created list type description
   */
  static listMultiType(values, min, max) {
    if ((JsConfig.#isNum(min) && min > values.length) || (JsConfig.#isNum(max) && max < min)) {
      throw "Invalid min/max";
    }
    return {
      type: JsConfig.#TYPE_LIST,
      values: values,
      multiple: true,
      min: min,
      max: max,
      eq: (v1, v2) => JSON.stringify(v1?.toSorted()) == JSON.stringify(v2?.toSorted())
    };
  }

  /**
   * Creates a numeric type description
   *
   * @param {number} [min] - min value
   * @param {number} [max] - max value
   * @param {number} [step] - increment for input form
   * @returns the created numeric type description
   */
  static numType(min, max, step) {
    return {
      type: JsConfig.#TYPE_NUM,
      min: min,
      max: max,
      step: step
    };
  }

  /**
   * Sets the config with pre-defined values, overriding defaults.
   * If the JsConfig object has a version, the setting is only applied if
   * the newConfig object has the same version value.
   * Triggers the change listener invocation when changes were applied.
   *
   * @param {object<string, boolean|string|integer>} newConfig - An object with config entries, that will override existing config entries
   * @returns this
   */
  setConfig(newConfig) {
    if (typeof newConfig == "string" && newConfig) {
      try {
        newConfig = JSON.parse(newConfig);
      } catch (error) {
        console.warn("Cannot set configuration with invalid value: " + newConfig);
        newConfig = undefined;
      }
    }
    if (newConfig &&
      // ony load compatible config version
      (!this._._version || (this._._version == newConfig._version))) {
      let isChanged = false;
      let _desc = this._desc;
      let _ = this._;
      for (let name in newConfig) {
        const value = newConfig[name];
        if (typeof _desc[name] !== "undefined") {
          isChanged = _desc[name]?.eq ? !_desc[name]?.eq(_[name], value) : _[name] != value;
          _[name] = value;
        }
      }
      // notify changes
      isChanged && this.change();
    }
    return this;
  }

  /**
   * Resets the config to the default values.
   * Triggers the change listener invocation.
   *
   * @returns this
   */
  resetToDefault() {
    this._ = {};
    let _ = this._;
    for (let name in this._desc) {
      _[name] = this._desc[name].defaultValue;
    }
    // notify changes
    this.change();
    return this;
  }

  /**
   * Defines the function to call when config values are changed
   *
   * @param {function} fn - The change listener function (no arguments)
   * @returns this
   */
  onChange(fn) {
    this._options.listener = fn;
    return this;
  }

  /**
   * Invokes the change listener, if defined
   *
   * @returns this
   */
  change() {
    // notify changes
    if (this._options.listener) {
      this._options.listener(this._);
    }
    return this;
  }

  /**
   * Displays the configuration into a table, either editable or readonly
   *
   * @param {HTMLElement} table - The HTML element for the target table to fill
   * @param {boolean} [readonly=false] - if set and true, the config not editable
   * @returns this
   */
  showConfigTable(table, readonly) {
    table.innerHTML = "";
    let _ = this._;
    this._table = table;
    const tbody = table.createTBody();
    let jsc = this;
    for (let name in this._desc) {
      const desc = this._desc[name];
      const trClass = desc.rowClass ? `class="${desc.rowClass}"` : "";
      tbody.insertAdjacentHTML("beforeend", `<tr ${trClass} id="jsconfig-row-${name}"></tr>`);
      const tr = table.querySelector("tr:last-child");
      const shownName = this._options?.capitalize ?
        (name.charAt(0).toUpperCase() + name.slice(1)).replaceAll("-", " ")
        : name;
      tr.insertAdjacentHTML("beforeend", `<td title="${desc.readableDesc}">${shownName}:</td>`);
      let input;
      let val = _[name];
      let type = desc.typeDesc;
      switch (type.type) {

        case JsConfig.#TYPE_BOOL:
          if (readonly) {
            input = val ? "TRUE" : "FALSE";
          } else {
            input = `<input type="checkbox" id="${name}" ${val ? "checked" : ""}/>`;
          }
          break;

        case JsConfig.#TYPE_TEXT:
          if (readonly) {
            input = val;
          } else {
            input = `<input type="text" id="${name}" value="${val.replaceAll('"', '&quot;')}"/>`;
          }
          break;

        case JsConfig.#TYPE_NUM:
          if (readonly) {
            input = val;
          } else {
            let attrs = "";
            if (JsConfig.#isNum(type.min)) {
              attrs += " min=${type.min}";
            }
            if (JsConfig.#isNum(type.max)) {
              attrs += " max=${type.max}";
            }
            if (typeof type.step != undefined) {
              attrs += " step=${type.step}";
            }
            input = `<input id="${name}" type="number" value="${val}"/>`;
          }
          break;

        case JsConfig.#TYPE_LIST:
          if (readonly) {
            input = val;
          } else {
            let options = "";
            for (const optV of type.values) {
              let selected;
              if (type.multiple) {
                selected = val.includes(optV) ? "selected" : "";
              } else {
                selected = val == optV ? "selected" : "";
              }
              options += `<option value='${optV}' ${selected}>${optV}</option>`;
            }
            input = `<select id="${name}" ${type.multiple ? "multiple" : ""}>${options}</select>`;
          }
          break;

        default:
          throw "Invalid type: " + type;
      }

      tr.insertAdjacentHTML("beforeend", `<td title="${desc.readableDesc}">${input}</td>`);
      desc.input = tr.querySelector("#" + name);
      if (jsc._options?.autoSave) {
        desc.input.addEventListener("change", () => { jsc.readConfigTable(); });
      }
    }
    return this;
  }

  /**
   * Sets the config with the value from the table.
   * Triggers the change listener invocation.
   *
   * @param {HTMLElement} table - The HTML document element for the config table to read. If undefined, the table used in last showConfigTable() is reused.
   * @returns this
   */
  readConfigTable(table) {
    if (!table) {
      table = this._table;
    }
    let _ = this._;
    for (const name in this._desc) {
      const desc = this._desc[name];
      let input = desc.input;
      let type = desc.typeDesc;
      let v;

      try {

        switch (type.type) {

          case JsConfig.#TYPE_BOOL:
            v = input.checked;
            break;

          case JsConfig.#TYPE_TEXT:
            v = input.value.trim();
            if (type.pattern) {
              if (!new RegExp(type.pattern).test(v)) {
                throw `Should match the pattern "${type.pattern}"`;
              }
            }
            break;

          case JsConfig.#TYPE_NUM:
            v = parseFloat(input.value);
            if (
              (isNaN(v)) ||
              (JsConfig.#isNum(type.min) && v < type.min) ||
              (JsConfig.#isNum(type.max) && v > type.max)
            ) {
              throw `"${v}" not in valid range (${type.min} to ${type.max})`;
            }
            break;

          case JsConfig.#TYPE_LIST:
            if (type.multiple) {
              v = [];
              document.querySelectorAll(`#${input.id} option:checked`).forEach(option => {
                v.push(option.value);
              });
              if (JsConfig.#isNum(type.min) && v.length < type.min) {
                throw `At least ${type.min} value must be selected`;
              }
              if (JsConfig.#isNum(type.max) && v.length > type.max) {
                throw `There cannot be more than ${type.max} value selected`;
              }
            } else {
              v = input.value;
              if (type.values.indexOf(v) < 0) {
                throw `"${v}" is not a valid value`;
              }
            }
            break;

          default:
            throw "Unknown type: " + type;
        }

        _[name] = v;

      } catch (error) {
        input.focus && input.focus();
        throw `Cannot set "${name}" value: ${error}`;
      }

    }
    // notify changes
    this.change();
    return this;
  }

}
