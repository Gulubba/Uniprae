/**
 * Advanced Asset Pipeline JSX Templates
 * Covers: advanced import (.psd/.ai/.svg/.mp4 with importAs modes), folder import,
 *         replace footage, interpret footage, set proxy
 */
import { sanitizeForJsx, buildCompTarget, buildLayerRef } from "./jsx-helpers.js";
export function buildImportAssetAdvancedJsx(opts) {
    const cleanPath = opts.filePath.replace(/\\/g, "/");
    const importAs = opts.importAs || "auto";
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Import Asset Advanced");
    var f = new File("${cleanPath}");
    if (!f.exists) {
      return { success: false, error: "File not found: " + f.fsName };
    }

    var io = new ImportOptions(f);

    // Determine import type based on file extension and user preference
    var ext = f.name.match(/\\.([^.]+)$/);
    ext = ext ? ext[1].toLowerCase() : "";

    var importMode = "${importAs}";
    if (importMode === "auto") {
      if (ext === "psd" || ext === "ai" || ext === "psb") {
        importMode = "comp";
      } else {
        importMode = "footage";
      }
    }

    if (importMode === "comp" && io.canImportAs(ImportAsType.COMP)) {
      io.importAs = ImportAsType.COMP;
    } else if (importMode === "comp_cropped" && io.canImportAs(ImportAsType.COMP_CROPPED_LAYERS)) {
      io.importAs = ImportAsType.COMP_CROPPED_LAYERS;
    } else if (io.canImportAs(ImportAsType.FOOTAGE)) {
      io.importAs = ImportAsType.FOOTAGE;
    }

    // Handle image sequences
    if (ext === "dpx" || ext === "exr" || ext === "tga" || ext === "tif" || ext === "tiff") {
      try { io.sequence = true; } catch(e) {}
    }

    var imported = app.project.importFile(io);
    ${opts.name ? `imported.name = "${sanitizeForJsx(opts.name)}";` : ""}

    var result = {
      success: true,
      itemId: imported.id,
      itemName: imported.name,
      itemType: imported instanceof CompItem ? "Composition" : "Footage"
    };

    // If imported as comp, it's already a comp — report details
    if (imported instanceof CompItem) {
      result.width = imported.width;
      result.height = imported.height;
      result.numLayers = imported.numLayers;
      result.duration = imported.duration;
    }

    // If imported as footage, add to target comp
    if (imported instanceof FootageItem) {
      ${opts.compName ? buildCompTarget(opts.compName).replace("var comp", "var comp2").replace("comp =", "comp2 =").replace(/comp\./g, "comp2.").replace("comp2 = app.project.activeItem", "comp = app.project.activeItem") : ""}
      var comp = ${opts.compName ? "null" : "app.project.activeItem"};
      ${opts.compName ? `for (var ci = 1; ci <= app.project.numItems; ci++) { if (app.project.item(ci) instanceof CompItem && app.project.item(ci).name === "${sanitizeForJsx(opts.compName || "")}") { comp = app.project.item(ci); break; } }` : ""}
      if (!comp || !(comp instanceof CompItem)) {
        for (var ci = 1; ci <= app.project.numItems; ci++) {
          if (app.project.item(ci) instanceof CompItem) { comp = app.project.item(ci); break; }
        }
      }

      if (comp) {
        var layer = comp.layers.add(imported);
        result.layerIndex = layer.index;
        result.layerName = layer.name;
        result.compName = comp.name;

        // Position
        ${opts.position
        ? `layer.property("ADBE Transform Group").property("ADBE Position").setValue([${opts.position[0]}, ${opts.position[1]}]);`
        : `layer.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width/2, comp.height/2]);`}

        // Scale
        ${opts.scale
        ? `layer.property("ADBE Transform Group").property("ADBE Scale").setValue([${opts.scale[0]}, ${opts.scale[1]}]);`
        : ""}

        // Fit to comp
        ${opts.fitToComp ? `
        try {
          var srcW = imported.width;
          var srcH = imported.height;
          if (srcW > 0 && srcH > 0) {
            var scaleX = (comp.width / srcW) * 100;
            var scaleY = (comp.height / srcH) * 100;
            var fitScale = Math.min(scaleX, scaleY);
            layer.property("ADBE Transform Group").property("ADBE Scale").setValue([fitScale, fitScale]);
          }
        } catch(e) {}
        ` : ""}
      }
    }

    app.endUndoGroup();
    return result;
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildImportFolderJsx(opts) {
    const cleanPath = opts.folderPath.replace(/\\/g, "/");
    const extFilter = opts.extensions ? opts.extensions.map(e => e.toLowerCase()) : null;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Import Folder");
    var folder = new Folder("${cleanPath}");
    if (!folder.exists) return { success: false, error: "Folder not found: ${cleanPath}" };

    var files = folder.getFiles();
    var imported = [];
    var skipped = [];
    var extFilter = ${extFilter ? JSON.stringify(extFilter) : "null"};

    // Create an AE folder to organize imports
    var aeFolder = app.project.items.addFolder(folder.name);

    for (var i = 0; i < files.length; i++) {
      if (files[i] instanceof Folder) continue; // skip subfolders
      var f = files[i];
      var ext = f.name.match(/\\.([^.]+)$/);
      ext = ext ? ext[1].toLowerCase() : "";

      if (extFilter) {
        var found = false;
        for (var e = 0; e < extFilter.length; e++) {
          if (ext === extFilter[e]) { found = true; break; }
        }
        if (!found) { skipped.push(f.name); continue; }
      }

      try {
        var io = new ImportOptions(f);
        ${opts.asSequence ? `try { io.sequence = true; } catch(e) {}` : ""}
        var item = app.project.importFile(io);
        item.parentFolder = aeFolder;
        imported.push({ name: item.name, id: item.id });
        ${opts.asSequence ? `break; // Only import first file for sequence` : ""}
      } catch(e) {
        skipped.push(f.name + " (" + e.toString() + ")");
      }
    }

    app.endUndoGroup();
    return { success: true, folderName: aeFolder.name, imported: imported, importedCount: imported.length, skipped: skipped };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildReplaceFootageJsx(opts) {
    const cleanPath = opts.newFilePath.replace(/\\/g, "/");
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Replace Footage");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    if (!layer.source || !(layer.source instanceof FootageItem)) {
      return { success: false, error: "Layer is not a footage layer" };
    }

    var f = new File("${cleanPath}");
    if (!f.exists) return { success: false, error: "Replacement file not found: " + f.fsName };

    layer.source.replace(f);
    app.endUndoGroup();
    return { success: true, layerName: layer.name, newSource: f.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildInterpretFootageJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Interpret Footage");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    if (!layer.source || !(layer.source instanceof FootageItem)) {
      return { success: false, error: "Layer is not a footage layer" };
    }

    var footage = layer.source;
    var interp = footage.mainSource;

    ${opts.frameRate !== undefined ? `
    if (interp.isStill !== true) {
      interp.conformFrameRate = ${opts.frameRate};
    }` : ""}

    ${opts.alphaMode ? `
    var modeMap = { "ignore": AlphaMode.IGNORE, "straight": AlphaMode.STRAIGHT, "premultiplied": AlphaMode.PREMULTIPLIED };
    if (modeMap["${opts.alphaMode}"]) {
      interp.alphaMode = modeMap["${opts.alphaMode}"];
    }` : ""}

    ${opts.loop !== undefined ? `interp.loop = ${opts.loop};` : ""}

    ${opts.fieldSeparation ? `
    var fieldMap = { "off": FieldSeparationType.OFF, "upperFirst": FieldSeparationType.UPPER_FIELD_FIRST, "lowerFirst": FieldSeparationType.LOWER_FIELD_FIRST };
    if (fieldMap["${opts.fieldSeparation}"]) {
      interp.fieldSeparationType = fieldMap["${opts.fieldSeparation}"];
    }` : ""}

    footage.mainSource = interp;
    app.endUndoGroup();
    return { success: true, footageName: footage.name, interpreted: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildSetFootageProxyJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Footage Proxy");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    if (!layer.source) return { success: false, error: "Layer has no source" };
    var item = layer.source;

    ${opts.proxyPath ? `
    var proxyFile = new File("${opts.proxyPath.replace(/\\/g, "/")}");
    if (!proxyFile.exists) return { success: false, error: "Proxy file not found" };
    item.setProxy(proxyFile);
    ` : `
    item.setProxyToNone();
    `}

    app.endUndoGroup();
    return { success: true, itemName: item.name, proxySet: ${opts.proxyPath ? "true" : "false"} };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
