export function buildOpenProjectJsx(opts) {
    const cleanPath = opts.path.replace(/\\/g, "/");
    return `
(function() {
  try {
    var f = new File("${cleanPath}");
    if (!f.exists) return { success: false, error: "Project file not found: " + f.fsName };
    var proj = app.open(f);
    return {
      success: true,
      projectName: proj.file ? proj.file.name : "Untitled",
      projectPath: proj.file ? proj.file.fsName : null,
      numItems: proj.numItems
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildSaveProjectJsx(opts) {
    const savePath = opts?.path ? opts.path.replace(/\\/g, "/") : null;
    return `
(function() {
  try {
    var proj = app.project;
    if (!proj) return { success: false, error: "No project open" };
    ${savePath
        ? `var f = new File("${savePath}"); proj.save(f);`
        : `if (proj.file) { proj.save(); } else { return { success: false, error: "Project has never been saved — provide a path" }; }`}
    return {
      success: true,
      projectPath: proj.file ? proj.file.fsName : null,
      message: "Project saved successfully"
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildCloseProjectJsx(opts) {
    const save = opts?.save !== false;
    return `
(function() {
  try {
    var proj = app.project;
    if (!proj) return { success: false, error: "No project open" };
    var name = proj.file ? proj.file.name : "Untitled";
    proj.close(${save ? "CloseOptions.SAVE_CHANGES" : "CloseOptions.DO_NOT_SAVE_CHANGES"});
    return { success: true, closedProject: name, saved: ${save} };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildGetProjectInfoJsx() {
    return `
(function() {
  try {
    var proj = app.project;
    if (!proj) return { success: false, error: "No project open" };

    var compCount = 0, footageCount = 0, folderCount = 0, missingFootage = [];
    for (var i = 1; i <= proj.numItems; i++) {
      var item = proj.item(i);
      if (item instanceof CompItem) compCount++;
      else if (item instanceof FolderItem) folderCount++;
      else if (item instanceof FootageItem) {
        footageCount++;
        if (item.mainSource instanceof PlaceholderSource || (item.footageMissing !== undefined && item.footageMissing)) {
          missingFootage.push(item.name);
        }
      }
    }

    var bitsPerChannel = "8";
    try { bitsPerChannel = String(proj.bitsPerChannel); } catch(e) {}

    return {
      success: true,
      projectName: proj.file ? proj.file.name : "Untitled",
      projectPath: proj.file ? proj.file.fsName : null,
      numItems: proj.numItems,
      compCount: compCount,
      footageCount: footageCount,
      folderCount: folderCount,
      missingFootage: missingFootage,
      bitsPerChannel: bitsPerChannel,
      linearBlending: proj.linearBlending || false,
      expressionEngine: proj.expressionEngine || "javascript-1.0"
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildCollectFilesJsx(opts) {
    const cleanPath = opts.outputFolder.replace(/\\/g, "/");
    return `
(function() {
  try {
    var proj = app.project;
    if (!proj || !proj.file) return { success: false, error: "Project must be saved before collecting files" };

    // Use AE's built-in collect files via command line
    // For ExtendScript, we manually copy referenced footage
    var outFolder = new Folder("${cleanPath}");
    if (!outFolder.exists) outFolder.create();

    var collected = [];
    var projectFolder = new Folder(outFolder.fsName + "/(Footage)/");
    if (!projectFolder.exists) projectFolder.create();

    for (var i = 1; i <= proj.numItems; i++) {
      var item = proj.item(i);
      if (item instanceof FootageItem && item.mainSource && item.mainSource.file) {
        try {
          var src = item.mainSource.file;
          if (src.exists) {
            var dest = new File(projectFolder.fsName + "/" + src.name);
            src.copy(dest);
            collected.push(src.name);
          }
        } catch(e) {}
      }
    }

    // Save project copy into collect folder
    var projCopy = new File(outFolder.fsName + "/" + proj.file.name);
    proj.save(projCopy);

    return { success: true, outputFolder: outFolder.fsName, collectedFiles: collected, count: collected.length };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildIncrementSaveJsx() {
    return `
(function() {
  try {
    var proj = app.project;
    if (!proj || !proj.file) return { success: false, error: "Project must be saved at least once first" };

    var origPath = proj.file.fsName;
    var baseName = proj.file.name.replace(/\\.aep$/i, "");

    // Find version number pattern _v001, _v002, etc.
    var versionMatch = baseName.match(/_v(\\d+)$/);
    var newName;
    if (versionMatch) {
      var num = parseInt(versionMatch[1], 10) + 1;
      var padded = ("000" + num).slice(-Math.max(3, versionMatch[1].length));
      newName = baseName.replace(/_v\\d+$/, "_v" + padded) + ".aep";
    } else {
      newName = baseName + "_v002.aep";
    }

    var parentFolder = proj.file.parent;
    var newFile = new File(parentFolder.fsName + "/" + newName);
    proj.save(newFile);

    return { success: true, previousPath: origPath, newPath: newFile.fsName, newName: newName };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
