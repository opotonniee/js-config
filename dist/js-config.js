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
  static #isSet(value) { return value !== null && value !== undefined; }

  #options;
  #items;

  /**
   * Build a JsConfig object.
   * @param {*} settings - Optional object with optional settings:<br>
   *  - listener {function} - callback when config is updated through the UI
   *  - autoSave {boolean} - Automatically save UI changes<br>
   *  - capitalize {boolean} - Capitalize 1st letter of setting name in table
   *  - version {integer} - config compatible version. See {@link JsConfig#setConfig}
   */
  constructor(settings) {
    // Private field holding the config entries's description
    this.#items = {
      _version: {
        value: settings?.version
      }
    };
    this.#options = settings;
  }

  #v = {};
  /**
   * Getter to access getter and setter for each config values. For example:
   *   <configObject>.value.<configName> // returns the <configName> value
   *   <configObject>.value.<configName> = 3 // sets the <configName> value, and persist it. Throws an error is value does not comply to the configuration definition.
   */
  get value() {
    return this.#v;
  }
  #addProperty(name) {
    let _this = this;
    Object.defineProperty(this.#v, name, {
      get() {
        return _this.#items[name]?.value;
      },
      set(value) {
        let item = _this.#items[name];
        if (item && item?.typeDesc) {
          item.set(value);
        }
      }
    });
  }

  /**
   * Return a cloned copy of the full config object value
   */
  toJSON() {
    const res={};
    for (let name in this.#items) {
      let val = this.#items[name].value;
      res[name] = Array.isArray(val) ? [...val] : val;
    }
    return res;
  }

  /**
   * Declares an additional config entry, setting initial/default values.
   * Triggers the change listener invocation.
   *
   * @param {string} name - Name of the config item
   * @param {object} typeDesc - Type of the config value, as returned by
   *                     boolType(), textType(), numType(), listType(), or listMultiType()
   * @param {boolean|string|number|array} defaultValue - Default config value
   * @param {string} [readableDesc] - Description for this config entry, will be displayed as a tooltip
   * @param {string} [rowClass] - HTML class of the table row for this config
   * @returns this
   */
  add(name, typeDesc, defaultValue, readableDesc, rowClass) {
    if (!JsConfig.#isSet(typeDesc)) {
      throw "Missing config item description";
    }
    this.#items[name] = {};
    this.update(name, typeDesc, defaultValue, readableDesc, rowClass);
    let item = this.#items[name];
    item.value = defaultValue;
    let cfg = this;
    item.set = function(value) {
      if (!item.typeDesc.isValid || item.typeDesc.isValid(value)) {
        item.value = value;
        cfg.change();
      } else {
        const msg = `Failed to set config ${name} to invalid value: ${value}`;
        cfg.#error(msg);
        return msg;
      }
    };
    this.#addProperty(name);
    // notify changes
    this.change();
    return this;
  }

/**
 * Updates one or several attributes of a config entry
 * Triggers the change listener invocation.
 *
 * @param {string} name - Name of the config item
 * @param {object} [typeDesc] - Type of the config value
 * @param {boolean|string|number|array} defaultValue - Default config value
 * @param {string} [readableDesc] - Description for this config entry, will be displayed as a tooltip
 * @param {string} [rowClass] - HTML class of the table row for this config
 * @returns this
 */
  update(name, typeDesc, defaultValue, readableDesc, rowClass) {
    let item = this.#items[name];
    if (!item) {
      throw "This config item does not exist";
    }
    if (JsConfig.#isSet(typeDesc)) {
      item.typeDesc = typeDesc;
    }
    if (JsConfig.#isSet(defaultValue)) {
      if (!item.typeDesc.isValid || item.typeDesc.isValid(defaultValue)) {
        item.defaultValue = defaultValue;
      } else {
        let msg = `Default value for ${name} is invalid: ${defaultValue}`;
        this.#error(msg);
      }
    }
    if (JsConfig.#isSet(readableDesc)) {
      item.readableDesc = readableDesc;
    }
    if (JsConfig.#isSet(rowClass)) {
      item.rowClass = rowClass;
    }
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
      type: JsConfig.#TYPE_BOOL,
      isValid: v => typeof(v) === "boolean"
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
      pattern: pattern,
      isValid: v => {
        if (typeof (v) !== "string") {
          return false;
        }
        if (pattern) {
          if (!new RegExp(pattern).test(v)) {
            return false;
          }
        }
        return true;
      }
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
      values: values,
      isValid: v => {
        return (values.indexOf(v) >= 0);
      }
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
      eq: (v1, v2) => JSON.stringify(v1?.toSorted()) == JSON.stringify(v2?.toSorted()),
      isValid: v => {
        if (!Array.isArray(v)) {
          return false;
        }
        if (JsConfig.#isNum(min) && v.length < min) {
          return false;
        }
        if (JsConfig.#isNum(max) && v.length > max) {
          return false;
        }
        for(const element of v) {
          if (!values.includes(element)) {
            return false;
          }
        }
        return true;
      }
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
      step: step,
      isValid: v => {
        return (this.#isNum(v)
          && (!this.#isNum(min) || v >= min)
          && (!this.#isNum(max) || v <= max)
        );
      }
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
    if (!newConfig) {
      // empty config
      console.warn("No stored configuration, using defaults");
      // abort
      return this;

    };
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
      (!this.#items._version || (this.#items._version.value == newConfig._version))) {
      let isChanged = false;
      for (let name in newConfig) {
        const value = newConfig[name];
        const item = this.#items[name];
        if (item.typeDesc) {
          isChanged = item?.eq ? !item?.eq(item.value, value) : item.value != value;
          item.set(value);
        }
      }
      // notify changes
      isChanged && this.change();
    } else {
      let msg = `Cannot load incompatible config v${this.#items._version}`;
      this.#error(msg);
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
    for (let name in this.#items) {
      if (!this.#items[name].typeDesc) continue; // not an config item
      this.#items[name].value = this.#items[name].defaultValue;
    }
    // notify changes
    this.change();
    return this;
  }

  /**
   * Defines the function to call when config values are changed
   *
   * @param {function} fn - The change listener function, which gets the new json config as argument
   * @returns this
   */
  onChange(fn) {
    this.#options.changeListener = fn;
    return this;
  }

  /**
   * Invokes the change listener, if defined
   *
   * @returns this
   */
  change() {
    // notify changes
    if (this.#options?.changeListener) {
      this.#options.changeListener(this.toJSON());
    }
    return this;
  }

  /**
   * Defines the function to call when an error is detected while processing the configuration
   *
   * @param {function} fn - The error listener function, which gets an error message as argument
   * @returns this
   */
  onError(fn) {
    this.#options.errorListener = fn;
    return this;
  }

  #error(msg) {
    console.error(msg);
    if (this.#options?.errorListener) {
      this.#options.errorListener(msg);
    }
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
    const tbody = table.createTBody();
    let jsc = this;
    for (let name in this.#items) {
      const item = this.#items[name];
      if (!item.typeDesc) continue; // not an application config item
      const trClass = item.rowClass ? `class="${item.rowClass}"` : "";
      tbody.insertAdjacentHTML("beforeend", `<tr ${trClass} id="jsconfig-row-${name}"></tr>`);
      const tr = table.querySelector("tr:last-child");
      const shownName = this.#options?.capitalize ?
        (name.charAt(0).toUpperCase() + name.slice(1)).replaceAll("-", " ")
        : name;
      tr.insertAdjacentHTML("beforeend", `<td title="${item.readableDesc}">${shownName}:</td>`);
      let input;
      let val = this.#items[name].value;
      let type = item.typeDesc;
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

      tr.insertAdjacentHTML("beforeend", `<td title="${item.readableDesc}">${input}</td>`);
      item.input = tr.querySelector("#" + name);
      if (jsc.#options?.autoSave) {
        item.input.addEventListener("change", () => { jsc.readConfigTable(); });
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
    for (const name in this.#items) {
      const item = this.#items[name];
      let input = item.input;
      let type = item.typeDesc;
      if (!type) continue; // not a config item
      let v;

      switch (type.type) {

        case JsConfig.#TYPE_BOOL:
          v = input.checked;
          break;

        case JsConfig.#TYPE_TEXT:
          v = input.value.trim();
          break;

        case JsConfig.#TYPE_NUM:
          v = parseFloat(input.value);
          break;

        case JsConfig.#TYPE_LIST:
          if (type.multiple) {
            v = [];
            document.querySelectorAll(`#${input.id} option:checked`).forEach(option => {
              v.push(option.value);
            });
          } else {
            v = input.value;
          }
          break;

        default:
          throw "Unknown type: " + type;
      }

      let error = this.#items[name].set(v);

      if (error) {
        input.focus && input.focus();
        throw `Cannot set "${name}" value: ${error}`;
      }

    }
    // notify changes
    this.change();
    return this;
  }

}
