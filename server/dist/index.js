import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { premiereEditorTools, callPremiereEditor } from './premiere-editor.js';
import { CallToolRequestSchema, GetPromptRequestSchema, ListPromptsRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// ═══════════════════════════════════════════════════════════════
// Original JSX Templates (backward compatible)
// ═══════════════════════════════════════════════════════════════
import { buildCreateCompJsx, buildAddTextLayerJsx, buildAddSolidLayerJsx, buildAddShapeLayerJsx, buildSetTransformJsx, buildAddEffectJsx, buildSetExpressionJsx, buildRunScriptJsx, buildGetActiveCompJsx, buildSaveFramePreviewJsx, buildSetEasingJsx, buildImportAssetJsx, buildPrecomposeJsx, buildApplyColorPaletteJsx, buildInspectCompJsx, buildApplyMotionPresetJsx, buildCreateCameraRigJsx, buildExportVideoPreviewJsx, buildHealthRepairJsx, buildGetLogsJsx, buildGetLiveReportJsx, buildDeleteLayerJsx, buildDuplicateLayerJsx, buildSetLayerTimingJsx, buildAddCameraLayerJsx, buildAddLightLayerJsx, buildKeyframeAssistantJsx, } from "./jsx-templates.js";
// ═══════════════════════════════════════════════════════════════
// NEW: Project Lifecycle
// ═══════════════════════════════════════════════════════════════
import { buildOpenProjectJsx, buildSaveProjectJsx, buildCloseProjectJsx, buildGetProjectInfoJsx, buildCollectFilesJsx, buildIncrementSaveJsx, } from "./jsx-project.js";
// ═══════════════════════════════════════════════════════════════
// NEW: Advanced Composition Management
// ═══════════════════════════════════════════════════════════════
import { buildDuplicateCompJsx, buildDeleteCompJsx, buildGetCompSettingsJsx, buildSetWorkAreaJsx, buildGetCompTreeJsx, buildAnalyzeCompJsx, } from "./jsx-comp-advanced.js";
// ═══════════════════════════════════════════════════════════════
// NEW: Advanced Layer Operations
// ═══════════════════════════════════════════════════════════════
import { buildSplitLayerJsx, buildSetLayerFlagsJsx, buildParentLayerJsx, buildSetBlendModeJsx, buildSetTrackMatteJsx, buildReorderLayerJsx, buildAddAdjustmentLayerJsx, buildTimeReverseLayerJsx, } from "./jsx-layers-advanced.js";
// ═══════════════════════════════════════════════════════════════
// NEW: Advanced Effects & Layer Styles
// ═══════════════════════════════════════════════════════════════
import { buildRemoveEffectJsx, buildToggleEffectJsx, buildSetEffectPropertyJsx, buildGetAvailableEffectsJsx, buildSetLayerStylesJsx, } from "./jsx-effects-advanced.js";
// ═══════════════════════════════════════════════════════════════
// NEW: Animation & Keyframe System
// ═══════════════════════════════════════════════════════════════
import { buildSetBezierEasingJsx, buildCopyPasteKeyframesJsx, buildLoopKeyframesJsx, buildDeleteKeyframesJsx, buildSetRovingKeyframesJsx, } from "./jsx-animation.js";
// ═══════════════════════════════════════════════════════════════
// NEW: Advanced Expressions
// ═══════════════════════════════════════════════════════════════
import { buildValidateExpressionJsx, buildToggleExpressionJsx, buildExpressionLibraryJsx, } from "./jsx-expressions-advanced.js";
// ═══════════════════════════════════════════════════════════════
// NEW: Advanced Asset Pipeline
// ═══════════════════════════════════════════════════════════════
import { buildImportAssetAdvancedJsx, buildImportFolderJsx, buildReplaceFootageJsx, buildInterpretFootageJsx, buildSetFootageProxyJsx, } from "./jsx-assets-advanced.js";
// ═══════════════════════════════════════════════════════════════
// NEW: Render Pipeline & Motion Blur
// ═══════════════════════════════════════════════════════════════
import { buildSetMotionBlurJsx, buildSetRenderSettingsJsx, buildGetRenderStatusJsx, buildCancelRenderJsx, buildStartRenderJsx, buildSetColorSettingsJsx, buildApplyLutJsx, } from "./jsx-render-advanced.js";
// ═══════════════════════════════════════════════════════════════
// NEW: AI-Native Features
// ═══════════════════════════════════════════════════════════════
import { buildDescribeCompJsx, buildFindLayerJsx, buildCreateTemplateJsx, buildLoadTemplateJsx, buildBatchComposeJsx, } from "./jsx-ai-features.js";
// ═══════════════════════════════════════════════════════════════
// NEW: System, Safety & Monitoring
// ═══════════════════════════════════════════════════════════════
import { buildGetSystemInfoJsx, buildMemoryCleanupJsx, buildGetPluginInventoryJsx, buildUndoJsx, buildCheckRenderFeasibilityJsx, buildProjectDiffJsx, buildAddMaskJsx, buildAnimateMaskJsx, buildTextUpdateJsx, buildTextToShapesJsx, } from "./jsx-system.js";
import fs from "fs";
import os from "os";
import path from "path";
import { AEBridge } from "./ae-bridge.js";
import { LicenseManager } from "./licensing.js";
import { getAdobeStatus, runAdobeScript, runPremiereFunction, triggerAdobeFunction } from "./adobe-universal.js";
import { removePremiereSilence, transcribeWithGroq, triggerPremiereSilencer, triggerPremiereTranscriber } from "./premiere-workflows.js";
const aeBridge = new AEBridge();
const licenseManager = new LicenseManager();
const server = new Server({
    name: "uniprae",
    version: "2.1.0",
}, {
    capabilities: {
        tools: {},
        prompts: {},
    },
});
// Standard MCP prompts. Clients that expose MCP prompts as slash commands can
// present these as /ae, /pr, and /uniprae.
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
        {
            name: "ae",
            title: "After Effects",
            description: "Route a creative or automation request to After Effects.",
            arguments: [{ name: "task", description: "What to create or change in After Effects", required: true }],
        },
        {
            name: "pr",
            title: "Premiere Pro",
            description: "Route an editing, transcription, or silence-removal request to Premiere Pro.",
            arguments: [{ name: "task", description: "What to edit or automate in Premiere Pro", required: true }],
        },
        {
            name: "uniprae",
            title: "Uniprae Auto Route",
            description: "Automatically route a request to the connected Adobe host.",
            arguments: [{ name: "task", description: "Adobe task to perform", required: true }],
        },
    ],
}));
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const task = request.params.arguments?.task || "Inspect the active project and wait for instructions.";
    const prompts = {
        ae: `Use Uniprae's ae_* tools and the After Effects host only. Inspect composition dimensions, frame rate, layers, assets and available fonts before editing. Preserve the user's reference, brand and copy; use clear hierarchy, readable typography, consistent spacing and safe margins. Keep text and shapes editable. Put anchors at the pivot required by the motion, compensating position after anchor changes; preserve world position when parenting and match property dimensionality for values and ease arrays. Use intentional entrance, readable hold and exit timing. Choose velocity curves from the desired character; use stagger, anticipation, overshoot, squash-and-stretch, springs, blur, glow or 3D selectively rather than universally. Treat glass, shadows, bloom, grain and particles as concept-dependent options. Protect focal subjects. Use exact supplied brand assets and never invent unavailable tools or a brand match. Preview entrance, hold and exit frames plus playback when available; correct clipping, contrast, alignment, layering and timing. Report unavailable visual verification honestly. Inspect after uncertain timeouts before retrying; do not overwrite unrelated work or render unless requested. Complete this request: ${task}`,
        pr: `Use Uniprae's ppro_* tools and the Premiere Pro host only. Inspect the active sequence first. Use ppro_trigger_silencer for the selected clip and ppro_trigger_transcriber for the active sequence or selected clip when no media path was supplied. Verify the created Silenced sequence or imported captions. Complete this request: ${task}`,
        uniprae: `Use adobe_get_status first, select the connected Adobe host, and complete this request with the matching Uniprae tools: ${task}`,
    };
    const text = prompts[request.params.name];
    if (!text)
        throw new Error(`Unknown Uniprae prompt: ${request.params.name}`);
    return { description: `Uniprae ${request.params.name} route`, messages: [{ role: "user", content: { type: "text", text } }] };
});
// ═══════════════════════════════════════════════════════════════════
// TOOL SCHEMAS — Full MCP Tool Registry
// ═══════════════════════════════════════════════════════════════════
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            ...premiereEditorTools,
            // ─────────────────────────────────────────────
            // ORIGINAL TOOLS (backward compatible)
            // ─────────────────────────────────────────────
            {
                name: "ae_create_comp",
                description: "Create a new Adobe After Effects composition with specified resolution, FPS, duration, and optional solid background color.",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Composition name" },
                        width: { type: "number", description: "Width in pixels (default: 1920)" },
                        height: { type: "number", description: "Height in pixels (default: 1080)" },
                        fps: { type: "number", description: "Frame rate (default: 30)" },
                        duration: { type: "number", description: "Duration in seconds (default: 10)" },
                        bgColor: { type: "string", description: "Background solid color hex (e.g. '#0F172A')" },
                    },
                    required: ["name"],
                },
            },
            {
                name: "ae_get_active_comp",
                description: "Get details of the currently active composition including resolution, duration, FPS, and layer list.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_get_preview",
                description: "Capture a rendered PNG preview frame of the active composition.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string", description: "Target composition name" },
                        time: { type: "number", description: "Time in seconds to render preview at" },
                    },
                },
            },
            {
                name: "ae_add_text_layer",
                description: "Create a formatted text layer (kinetic typography, titles, lower-thirds).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string", description: "Target composition name" },
                        text: { type: "string", description: "Text content to display" },
                        fontSize: { type: "number", description: "Font size in points (default: 72)" },
                        font: { type: "string", description: "Font PostScript name or font family" },
                        color: { type: "string", description: "Text fill color as hex" },
                        position: { type: "array", items: { type: "number" }, description: "[X, Y] position" },
                        alignment: { type: "string", enum: ["left", "center", "right"] },
                        tracking: { type: "number", description: "Letter spacing" },
                        name: { type: "string", description: "Layer name in timeline" },
                    },
                    required: ["text"],
                },
            },
            {
                name: "ae_add_solid_layer",
                description: "Add a color solid layer to the timeline.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        name: { type: "string", description: "Solid layer name" },
                        color: { type: "string", description: "Solid hex color" },
                        width: { type: "number" },
                        height: { type: "number" },
                        position: { type: "array", items: { type: "number" } },
                        opacity: { type: "number", description: "Opacity 0-100" },
                    },
                    required: ["color"],
                },
            },
            {
                name: "ae_add_shape_layer",
                description: "Create a vector shape layer (rectangle, ellipse, star) with fill, stroke, and rounded corners.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        name: { type: "string" },
                        shapeType: { type: "string", enum: ["rect", "ellipse", "star"] },
                        fillColor: { type: "string" },
                        strokeColor: { type: "string" },
                        strokeWidth: { type: "number" },
                        size: { type: "array", items: { type: "number" } },
                        position: { type: "array", items: { type: "number" } },
                        cornerRadius: { type: "number" },
                    },
                },
            },
            {
                name: "ae_set_transform",
                description: "Set static values or keyframe animations for Position, Scale, Rotation, Opacity, and Anchor Point.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string", description: "Layer name or index number" },
                        position: { description: "Static [X,Y] or keyframe array [{time, value}]" },
                        scale: { description: "Static [X,Y] scale or keyframe array" },
                        rotation: { description: "Static degrees or keyframe array" },
                        opacity: { description: "Static 0-100 or keyframe array" },
                        anchorPoint: { description: "Static [X,Y] anchor point" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            {
                name: "ae_add_effect",
                description: "Apply native AE effects (Glow, Gaussian Blur, Drop Shadow, Fill, Slider Controls).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        effectMatchName: { type: "string", description: "AE effect match name" },
                        effectName: { type: "string", description: "Custom display name" },
                        properties: { type: "object", description: "Key-value effect properties" },
                    },
                    required: ["layerIdentifier", "effectMatchName"],
                },
            },
            {
                name: "ae_set_expression",
                description: "Apply a JavaScript expression to any layer property (wiggle, loopOut, time*100, etc.).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        propertyPath: { type: "array", items: { type: "string" }, description: "e.g. ['Transform', 'Position']" },
                        expression: { type: "string" },
                    },
                    required: ["layerIdentifier", "propertyPath", "expression"],
                },
            },
            {
                name: "ae_set_easing",
                description: "Apply keyframe easing curves (easeIn, easeOut, easeInOut) to animated properties.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        propertyPath: { type: "array", items: { type: "string" } },
                        easeType: { type: "string", enum: ["easeIn", "easeOut", "easeInOut", "linear"] },
                        influence: { type: "number", description: "Easing influence 0-100" },
                    },
                    required: ["layerIdentifier", "propertyPath"],
                },
            },
            {
                name: "ae_import_asset",
                description: "Import external files (PNG/JPG/SVG/MP4/MP3) into the project and active composition.",
                inputSchema: {
                    type: "object",
                    properties: {
                        filePath: { type: "string" },
                        compName: { type: "string" },
                        name: { type: "string" },
                        position: { type: "array", items: { type: "number" } },
                        scale: { type: "array", items: { type: "number" } },
                    },
                    required: ["filePath"],
                },
            },
            {
                name: "ae_import_file",
                description: "Import external footage, 3D renders, video, or audio files into the project bin and composition timeline.",
                inputSchema: {
                    type: "object",
                    properties: {
                        filePath: { type: "string", description: "Absolute path to the asset file" },
                        compName: { type: "string", description: "Target composition name" },
                        name: { type: "string", description: "Custom name in timeline/bin" },
                        position: { type: "array", items: { type: "number" }, description: "[X, Y] position" },
                        scale: { type: "array", items: { type: "number" }, description: "[ScaleX, ScaleY] percentage" },
                    },
                    required: ["filePath"],
                },
            },
            {
                name: "ae_add_camera_layer",
                description: "Create a 3D Camera layer with lens options (zoom, depth of field, focus distance, aperture).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        name: { type: "string", description: "Camera layer name" },
                        centerPoint: { type: "array", items: { type: "number" }, description: "[X, Y] center point" },
                        position: { type: "array", items: { type: "number" }, description: "[X, Y, Z] position" },
                        pointOfInterest: { type: "array", items: { type: "number" }, description: "[X, Y, Z] point of interest" },
                        zoom: { type: "number" },
                        depthOfField: { type: "boolean" },
                        focusDistance: { type: "number" },
                        aperture: { type: "number" },
                        blurLevel: { type: "number" },
                    },
                },
            },
            {
                name: "ae_add_light_layer",
                description: "Add a 3D Light layer (Ambient, Spot, Point, Parallel) with shading and shadow settings.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        name: { type: "string", description: "Light layer name" },
                        lightType: { type: "string", enum: ["parallel", "spot", "point", "ambient"] },
                        color: { type: "string", description: "Hex color code e.g. '#FFFFFF'" },
                        intensity: { type: "number", description: "Intensity percentage e.g. 100" },
                        position: { type: "array", items: { type: "number" }, description: "[X, Y, Z] position" },
                        coneAngle: { type: "number", description: "Spotlight cone angle in degrees" },
                        coneFeather: { type: "number", description: "Spotlight cone feather percentage" },
                        castsShadows: { type: "boolean" },
                        shadowDarkness: { type: "number" },
                    },
                },
            },
            {
                name: "ae_keyframe_assistant",
                description: "Inject mathematical easing curve profiles (Exponential, Elastic, Bounce, Back, Bezier) into property keyframes.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string", description: "Layer name or index number" },
                        propertyPath: { type: "array", items: { type: "string" }, description: "Property path e.g. ['ADBE Transform Group', 'ADBE Position']" },
                        curveType: { type: "string", enum: ["exponential", "elastic", "bounce", "back", "cubicBezier", "smoothEase"] },
                        influence: { type: "number", description: "Ease influence percentage (0-100)" },
                        amplitude: { type: "number" },
                        frequency: { type: "number" },
                    },
                    required: ["layerIdentifier", "propertyPath", "curveType"],
                },
            },
            {
                name: "ae_precompose",
                description: "Group multiple layers into a new nested pre-composition.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIndices: { type: "array", items: { type: "number" } },
                        precompName: { type: "string" },
                    },
                    required: ["layerIndices", "precompName"],
                },
            },
            {
                name: "ae_apply_color_palette",
                description: "Apply or swap a global color palette across text and background layers.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        colors: {
                            type: "object",
                            properties: { primary: { type: "string" }, secondary: { type: "string" }, background: { type: "string" }, text: { type: "string" } },
                        },
                    },
                    required: ["colors"],
                },
            },
            {
                name: "ae_inspect_comp",
                description: "Inspect composition structure (layer names, indices, types, 3D states, effects).",
                inputSchema: {
                    type: "object",
                    properties: { compName: { type: "string" } },
                },
            },
            {
                name: "ae_apply_motion_preset",
                description: "Apply preset motion expressions (bounce, elastic, wiggle, rubberband).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        propertyName: { type: "string", enum: ["position", "scale", "rotation", "opacity"] },
                        presetType: { type: "string", enum: ["bounce", "elastic", "wiggle", "rubberband"] },
                        frequency: { type: "number" },
                        amplitude: { type: "number" },
                        decay: { type: "number" },
                    },
                    required: ["layerIdentifier", "propertyName", "presetType"],
                },
            },
            {
                name: "ae_create_camera_rig",
                description: "Create a 3D Camera Rig with parent Null controller and studio lighting.",
                inputSchema: { type: "object", properties: { compName: { type: "string" } } },
            },
            {
                name: "ae_get_user_requests",
                description: "Check and retrieve interactive prompt instructions or frame snapshots triggered by the user from the After Effects Watcher UI panel.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "ae_export_video_preview",
                description: "Export PNG frame samples across the timeline to inspect animation.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        frameCount: { type: "number", description: "Number of frames to sample (default: 3)" },
                    },
                },
            },
            {
                name: "ae_connection_status",
                description: "Diagnose the AE process, watcher heartbeat, generation, and IPC queues without requiring a working watcher or license.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_health_repair",
                description: "Check AE watcher status and clear pending queues.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_run_script",
                description: "Execute arbitrary ExtendScript (JSX) code inside After Effects.",
                inputSchema: {
                    type: "object",
                    properties: { code: { type: "string", description: "ExtendScript JSX code" } },
                    required: ["code"],
                },
            },
            {
                name: "ae_get_logs",
                description: "Retrieve the AE MCP watcher execution logs.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_live_report",
                description: "Get a live diagnostic report of After Effects state.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_delete_layer",
                description: "Remove/delete a layer from a composition.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            {
                name: "ae_duplicate_layer",
                description: "Duplicate a layer including all keyframes and effects.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        newName: { type: "string" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            {
                name: "ae_set_layer_timing",
                description: "Set layer in point, out point, and start time for animation sequencing.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        inPoint: { type: "number" },
                        outPoint: { type: "number" },
                        startTime: { type: "number" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            // ─────────────────────────────────────────────
            // NEW: PROJECT LIFECYCLE
            // ─────────────────────────────────────────────
            {
                name: "ae_project_open",
                description: "Open an After Effects project file (.aep).",
                inputSchema: {
                    type: "object",
                    properties: { path: { type: "string", description: "Absolute path to .aep file" } },
                    required: ["path"],
                },
            },
            {
                name: "ae_project_save",
                description: "Save the current project. Provide path for 'Save As'.",
                inputSchema: {
                    type: "object",
                    properties: { path: { type: "string", description: "Output path for Save As (optional)" } },
                },
            },
            {
                name: "ae_project_close",
                description: "Close the current project with optional save.",
                inputSchema: {
                    type: "object",
                    properties: { save: { type: "boolean", description: "Save before closing (default: true)" } },
                },
            },
            {
                name: "ae_project_info",
                description: "Get project info: bit depth, color space, footage count, comps, missing footage.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_project_collect_files",
                description: "Collect all project files into a portable folder.",
                inputSchema: {
                    type: "object",
                    properties: { outputFolder: { type: "string", description: "Destination folder path" } },
                    required: ["outputFolder"],
                },
            },
            {
                name: "ae_project_increment_save",
                description: "Version up and save (_v001 → _v002).",
                inputSchema: { type: "object", properties: {} },
            },
            // ─────────────────────────────────────────────
            // NEW: COMPOSITION MANAGEMENT
            // ─────────────────────────────────────────────
            {
                name: "ae_comp_duplicate",
                description: "Duplicate an entire composition (critical for template workflows).",
                inputSchema: {
                    type: "object",
                    properties: {
                        sourceName: { type: "string", description: "Source composition name" },
                        newName: { type: "string", description: "New composition name" },
                    },
                    required: ["sourceName"],
                },
            },
            {
                name: "ae_comp_delete",
                description: "Delete a composition from the project.",
                inputSchema: {
                    type: "object",
                    properties: { compName: { type: "string" } },
                    required: ["compName"],
                },
            },
            {
                name: "ae_comp_settings",
                description: "Get full composition settings (resolution, fps, work area, renderer, motion blur).",
                inputSchema: {
                    type: "object",
                    properties: { compName: { type: "string" } },
                },
            },
            {
                name: "ae_comp_set_work_area",
                description: "Set the work area start and end for preview/render range.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        startTime: { type: "number", description: "Start time in seconds" },
                        endTime: { type: "number", description: "End time in seconds" },
                    },
                    required: ["startTime", "endTime"],
                },
            },
            {
                name: "ae_comp_tree",
                description: "Get hierarchical tree view of nested compositions and their layers.",
                inputSchema: {
                    type: "object",
                    properties: { compName: { type: "string" } },
                },
            },
            {
                name: "ae_comp_analyze",
                description: "Deep analysis: layer count by type, keyframes, expressions, effects inventory, complexity score.",
                inputSchema: {
                    type: "object",
                    properties: { compName: { type: "string" } },
                },
            },
            // ─────────────────────────────────────────────
            // NEW: LAYER OPERATIONS
            // ─────────────────────────────────────────────
            {
                name: "ae_layer_split",
                description: "Split a layer at a specific time into two layers.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        splitTime: { type: "number", description: "Split time in seconds" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            {
                name: "ae_layer_flags",
                description: "Set layer flags: lock, shy, hide, guide, solo, collapse, adjustment, 3D, motion blur.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        locked: { type: "boolean" },
                        shy: { type: "boolean" },
                        enabled: { type: "boolean", description: "Visible" },
                        guideLayer: { type: "boolean" },
                        solo: { type: "boolean" },
                        collapseTransformation: { type: "boolean" },
                        adjustmentLayer: { type: "boolean" },
                        threeDLayer: { type: "boolean" },
                        motionBlur: { type: "boolean" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            {
                name: "ae_layer_parent",
                description: "Parent one layer to another, or unparent (set parentLayerIdentifier to null).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        childLayerIdentifier: { type: "string" },
                        parentLayerIdentifier: { description: "Parent layer name/index, or null to unparent" },
                    },
                    required: ["childLayerIdentifier", "parentLayerIdentifier"],
                },
            },
            {
                name: "ae_layer_blend_mode",
                description: "Set layer blending mode (all 38+ AE blend modes: add, multiply, screen, overlay, etc.).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        blendMode: { type: "string", description: "Blend mode: normal, add, multiply, screen, overlay, softLight, hardLight, colorDodge, colorBurn, difference, exclusion, etc." },
                    },
                    required: ["layerIdentifier", "blendMode"],
                },
            },
            {
                name: "ae_layer_track_matte",
                description: "Set track matte type (alpha, luma, inverted variants) for compositing.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        matteType: { type: "string", enum: ["alpha", "alphaInverted", "luma", "lumaInverted", "none"] },
                        matteLayerIdentifier: { type: "string", description: "Layer to use as matte (optional if directly above)" },
                    },
                    required: ["layerIdentifier", "matteType"],
                },
            },
            {
                name: "ae_layer_reorder",
                description: "Move a layer to a new index position in the stack.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        newIndex: { type: "number", description: "Target 1-based index" },
                    },
                    required: ["layerIdentifier", "newIndex"],
                },
            },
            {
                name: "ae_add_adjustment_layer",
                description: "Add an adjustment layer at the top of the stack.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        name: { type: "string", description: "Adjustment layer name" },
                    },
                },
            },
            {
                name: "ae_layer_time_reverse",
                description: "Reverse the time of a layer (play backwards).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            // ─────────────────────────────────────────────
            // NEW: EFFECTS ENGINE
            // ─────────────────────────────────────────────
            {
                name: "ae_effect_remove",
                description: "Remove an effect from a layer by name or index.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        effectName: { type: "string" },
                        effectIndex: { type: "number", description: "1-based effect index" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            {
                name: "ae_effect_toggle",
                description: "Enable or disable an effect on a layer.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        effectName: { type: "string" },
                        effectIndex: { type: "number" },
                        enabled: { type: "boolean" },
                    },
                    required: ["layerIdentifier", "enabled"],
                },
            },
            {
                name: "ae_effect_set_property",
                description: "Set an effect property value (optionally as a keyframe).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        effectName: { type: "string" },
                        effectIndex: { type: "number" },
                        propertyName: { type: "string" },
                        value: { description: "Property value" },
                        time: { type: "number", description: "Time for keyframe" },
                    },
                    required: ["layerIdentifier", "propertyName", "value"],
                },
            },
            {
                name: "ae_effect_list_available",
                description: "Get a searchable inventory of all installed effects including third-party plugins.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_set_layer_styles",
                description: "Apply Photoshop-compatible Layer Styles: Drop Shadow, Inner/Outer Glow, Bevel & Emboss, Color Overlay, Stroke, etc.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        dropShadow: { type: "object", description: "{ color, opacity, angle, distance, size, spread }" },
                        innerShadow: { type: "object", description: "{ color, opacity, angle, distance, size }" },
                        outerGlow: { type: "object", description: "{ color, opacity, size, spread }" },
                        innerGlow: { type: "object", description: "{ color, opacity, size }" },
                        bevelEmboss: { type: "object", description: "{ style, depth, size, soften, angle, altitude }" },
                        colorOverlay: { type: "object", description: "{ color, opacity }" },
                        stroke: { type: "object", description: "{ color, size, position, opacity }" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            // ─────────────────────────────────────────────
            // NEW: KEYFRAME & ANIMATION SYSTEM
            // ─────────────────────────────────────────────
            {
                name: "ae_keyframe_bezier",
                description: "Set bezier easing curves on keyframes — full graph editor control with speed/influence or named presets.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        propertyPath: { type: "array", items: { type: "string" } },
                        keyframeIndex: { type: "number", description: "1-based keyframe index (0 = all)" },
                        inSpeed: { type: "number" },
                        inInfluence: { type: "number", description: "0-100%" },
                        outSpeed: { type: "number" },
                        outInfluence: { type: "number", description: "0-100%" },
                        spatialIn: { type: "array", items: { type: "number" }, description: "Spatial in tangent [x,y,z]" },
                        spatialOut: { type: "array", items: { type: "number" }, description: "Spatial out tangent [x,y,z]" },
                        preset: { type: "string", enum: ["smooth", "sharp", "overshoot", "anticipation", "easeIn", "easeOut"] },
                    },
                    required: ["layerIdentifier", "propertyPath"],
                },
            },
            {
                name: "ae_keyframe_copy_paste",
                description: "Copy keyframes from one property to another (optionally with time offset).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        sourceLayerIdentifier: { type: "string" },
                        sourcePropertyPath: { type: "array", items: { type: "string" } },
                        targetLayerIdentifier: { type: "string" },
                        targetPropertyPath: { type: "array", items: { type: "string" } },
                        timeOffset: { type: "number", description: "Shift keyframes by seconds" },
                    },
                    required: ["sourceLayerIdentifier", "sourcePropertyPath", "targetLayerIdentifier", "targetPropertyPath"],
                },
            },
            {
                name: "ae_keyframe_loop",
                description: "Loop keyframes with cycle, pingpong, offset, or continue modes.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        propertyPath: { type: "array", items: { type: "string" } },
                        loopType: { type: "string", enum: ["cycle", "pingpong", "offset", "continue"] },
                        loopIn: { type: "boolean", description: "Apply loop to incoming (default: false)" },
                        loopOut: { type: "boolean", description: "Apply loop to outgoing (default: true)" },
                    },
                    required: ["layerIdentifier", "propertyPath", "loopType"],
                },
            },
            {
                name: "ae_keyframe_delete",
                description: "Delete keyframes — specific index, time range, or all.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        propertyPath: { type: "array", items: { type: "string" } },
                        keyframeIndex: { type: "number", description: "1-based index (0 = all)" },
                        timeRange: { type: "array", items: { type: "number" }, description: "[startTime, endTime]" },
                    },
                    required: ["layerIdentifier", "propertyPath"],
                },
            },
            {
                name: "ae_keyframe_roving",
                description: "Enable/disable roving keyframes for smooth motion paths.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        propertyPath: { type: "array", items: { type: "string" } },
                        enabled: { type: "boolean" },
                    },
                    required: ["layerIdentifier", "propertyPath", "enabled"],
                },
            },
            // ─────────────────────────────────────────────
            // NEW: EXPRESSIONS
            // ─────────────────────────────────────────────
            {
                name: "ae_expression_validate",
                description: "Validate an expression for syntax errors BEFORE applying it.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        propertyPath: { type: "array", items: { type: "string" } },
                        expression: { type: "string" },
                    },
                    required: ["layerIdentifier", "propertyPath", "expression"],
                },
            },
            {
                name: "ae_expression_toggle",
                description: "Enable or disable an existing expression without removing it.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        propertyPath: { type: "array", items: { type: "string" } },
                        enabled: { type: "boolean" },
                    },
                    required: ["layerIdentifier", "propertyPath", "enabled"],
                },
            },
            {
                name: "ae_expression_library",
                description: "Apply pre-built expression presets: wiggle, inertialBounce, elasticScale, autoRotate, fadeInOut, parallax, typewriter, counter, pendulum.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        propertyPath: { type: "array", items: { type: "string" } },
                        presetName: { type: "string", enum: ["wiggle", "inertialBounce", "elasticScale", "autoRotate", "timeRemap", "fadeInOut", "parallax", "typewriter", "counter", "pendulum"] },
                        params: { type: "object", description: "Optional overrides: { frequency, amplitude, decay, speed, fadeIn, fadeOut, start, end, duration }" },
                    },
                    required: ["layerIdentifier", "propertyPath", "presetName"],
                },
            },
            // ─────────────────────────────────────────────
            // NEW: ASSET PIPELINE
            // ─────────────────────────────────────────────
            {
                name: "ae_import_asset_advanced",
                description: "Advanced import: .psd/.ai as comp with layers, .svg, video footage, image sequences. Supports fitToComp auto-scaling.",
                inputSchema: {
                    type: "object",
                    properties: {
                        filePath: { type: "string", description: "Absolute path to file" },
                        importAs: { type: "string", enum: ["footage", "comp", "comp_cropped"], description: "Import mode (auto-detects for PSD/AI)" },
                        compName: { type: "string" },
                        name: { type: "string" },
                        position: { type: "array", items: { type: "number" } },
                        scale: { type: "array", items: { type: "number" } },
                        fitToComp: { type: "boolean", description: "Auto-scale to fit composition" },
                    },
                    required: ["filePath"],
                },
            },
            {
                name: "ae_import_folder",
                description: "Batch import all files from a folder with optional extension filtering.",
                inputSchema: {
                    type: "object",
                    properties: {
                        folderPath: { type: "string" },
                        extensions: { type: "array", items: { type: "string" }, description: "Filter: ['png', 'jpg']" },
                        asSequence: { type: "boolean", description: "Import as image sequence" },
                    },
                    required: ["folderPath"],
                },
            },
            {
                name: "ae_replace_footage",
                description: "Replace a layer's footage source with a new file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        newFilePath: { type: "string" },
                    },
                    required: ["layerIdentifier", "newFilePath"],
                },
            },
            {
                name: "ae_interpret_footage",
                description: "Set footage interpretation: frame rate, alpha mode, loop count, field separation.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        frameRate: { type: "number" },
                        alphaMode: { type: "string", enum: ["ignore", "straight", "premultiplied"] },
                        loop: { type: "number" },
                        fieldSeparation: { type: "string", enum: ["off", "upperFirst", "lowerFirst"] },
                    },
                    required: ["layerIdentifier"],
                },
            },
            {
                name: "ae_set_footage_proxy",
                description: "Set or remove a proxy for a footage item.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        proxyPath: { type: "string", description: "Path to proxy file (omit to remove proxy)" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            // ─────────────────────────────────────────────
            // NEW: RENDER PIPELINE
            // ─────────────────────────────────────────────
            {
                name: "ae_set_motion_blur",
                description: "Enable GPU-accelerated motion blur: per-layer or comp-wide with shutter angle/phase control.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string", description: "Specific layer (omit for comp-wide)" },
                        enabled: { type: "boolean" },
                        shutterAngle: { type: "number", description: "0-720 degrees (default: 180)" },
                        shutterPhase: { type: "number", description: "-360 to 360 degrees (default: -90)" },
                        samplesPerFrame: { type: "number", description: "Render quality (default: 16)" },
                        adaptiveSampleLimit: { type: "number", description: "Max samples (default: 128)" },
                    },
                    required: ["enabled"],
                },
            },
            {
                name: "ae_set_render_settings",
                description: "Configure render queue: quality, resolution, codec (H.264/ProRes/PNG/EXR), color depth, and start render.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        quality: { type: "string", enum: ["best", "draft", "wireframe"] },
                        resolution: { type: "string", enum: ["full", "half", "third", "quarter"] },
                        motionBlurOverride: { type: "string", enum: ["on", "off", "compSettings"] },
                        fieldRender: { type: "string", enum: ["off", "upperFirst", "lowerFirst"] },
                        frameBlending: { type: "string", enum: ["on", "off", "compSettings"] },
                        codec: { type: "string", enum: ["h264", "prores422", "prores4444", "pngSequence", "exr", "tiff"] },
                        colorDepth: { type: "string", enum: ["8bpc", "16bpc", "32bpc"] },
                        outputPath: { type: "string" },
                        startRender: { type: "boolean" },
                    },
                },
            },
            {
                name: "ae_render_status",
                description: "Get render queue status: progress, items, estimated time.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_render_start",
                description: "Start rendering all queued items.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_render_cancel",
                description: "Stop/cancel the current render.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_set_color_settings",
                description: "Set project color management: working space, linearize, bits per channel.",
                inputSchema: {
                    type: "object",
                    properties: {
                        workingSpace: { type: "string", description: "e.g. 'sRGB IEC61966-2.1'" },
                        linearize: { type: "boolean" },
                        bitsPerChannel: { type: "number", enum: [8, 16, 32] },
                    },
                },
            },
            {
                name: "ae_apply_lut",
                description: "Apply a color LUT file to a layer for consistent look development.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        lutPath: { type: "string", description: "Path to .cube/.3dl LUT file" },
                    },
                    required: ["layerIdentifier", "lutPath"],
                },
            },
            // ─────────────────────────────────────────────
            // NEW: AI-NATIVE FEATURES
            // ─────────────────────────────────────────────
            {
                name: "ae_describe_comp",
                description: "Generate a human-readable semantic description of a composition for AI context.",
                inputSchema: {
                    type: "object",
                    properties: { compName: { type: "string" } },
                },
            },
            {
                name: "ae_find_layer",
                description: "Semantic/fuzzy search for layers: 'the red text layer', 'background video', 'camera'.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        query: { type: "string", description: "Natural language search query" },
                    },
                    required: ["query"],
                },
            },
            {
                name: "ae_template_create",
                description: "Snapshot the current composition as a reusable JSON template.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        templateName: { type: "string" },
                        outputPath: { type: "string", description: "Path to save template JSON" },
                    },
                    required: ["templateName", "outputPath"],
                },
            },
            {
                name: "ae_template_load",
                description: "Load a JSON template and recreate the composition with text/color substitutions.",
                inputSchema: {
                    type: "object",
                    properties: {
                        templatePath: { type: "string" },
                        substitutions: { type: "object", description: "{ layerName: 'newText', ... }" },
                        newCompName: { type: "string" },
                    },
                    required: ["templatePath"],
                },
            },
            {
                name: "ae_batch_compose",
                description: "Generate multiple personalized compositions from a data array (e.g. for batch video generation).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string", description: "Source template comp" },
                        dataArray: { type: "array", items: { type: "object" }, description: "Array of { layerName: 'newText' } objects" },
                        outputPrefix: { type: "string" },
                    },
                    required: ["dataArray"],
                },
            },
            // ─────────────────────────────────────────────
            // NEW: SYSTEM, SAFETY & MONITORING
            // ─────────────────────────────────────────────
            {
                name: "ae_system_info",
                description: "Get system info: AE version, GPU status, memory, renderer, expression engine.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_memory_cleanup",
                description: "Purge all caches (RAM, disk, snapshots) to free memory.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_plugin_inventory",
                description: "Get inventory of all installed effects/plugins including third-party suites.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ae_undo",
                description: "Undo or redo operations with optional step count.",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: { type: "string", enum: ["undo", "redo"] },
                        steps: { type: "number", description: "Number of undo/redo steps (default: 1)" },
                    },
                    required: ["action"],
                },
            },
            {
                name: "ae_check_render_feasibility",
                description: "Pre-render validation: missing footage, expression errors, disabled effects, performance warnings.",
                inputSchema: {
                    type: "object",
                    properties: { compName: { type: "string" } },
                },
            },
            {
                name: "ae_project_diff",
                description: "Snapshot current project state for diff comparison (AI self-correction loops).",
                inputSchema: { type: "object", properties: {} },
            },
            // ─────────────────────────────────────────────
            // NEW: MASKS & MATTES
            // ─────────────────────────────────────────────
            {
                name: "ae_mask_add",
                description: "Add a mask to a layer with vertices, mode (add/subtract/intersect), feather, expansion.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        vertices: { type: "array", items: { type: "array", items: { type: "number" } }, description: "[[x1,y1], [x2,y2], ...]" },
                        mode: { type: "string", enum: ["add", "subtract", "intersect", "difference", "none"] },
                        feather: { type: "number" },
                        expansion: { type: "number" },
                        opacity: { type: "number", description: "Mask opacity 0-100" },
                        inverted: { type: "boolean" },
                        name: { type: "string" },
                    },
                    required: ["layerIdentifier", "vertices"],
                },
            },
            {
                name: "ae_mask_animate",
                description: "Animate mask path vertices over time with keyframes.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        maskIndex: { type: "number", description: "1-based mask index" },
                        keyframes: { type: "array", items: { type: "object" }, description: "[{ time: 0, vertices: [[x,y],...] }, ...]" },
                    },
                    required: ["layerIdentifier", "maskIndex", "keyframes"],
                },
            },
            // ─────────────────────────────────────────────
            // NEW: TEXT TOOLS
            // ─────────────────────────────────────────────
            {
                name: "ae_text_update",
                description: "Update text content while preserving formatting (font, size, color, tracking).",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                        newText: { type: "string" },
                        preserveFormatting: { type: "boolean", description: "Keep existing style (default: true)" },
                    },
                    required: ["layerIdentifier", "newText"],
                },
            },
            {
                name: "ae_text_to_shapes",
                description: "Convert a text layer into editable shape outlines.",
                inputSchema: {
                    type: "object",
                    properties: {
                        compName: { type: "string" },
                        layerIdentifier: { type: "string" },
                    },
                    required: ["layerIdentifier"],
                },
            },
            // ─────────────────────────────────────────────
            // NEW: RENDER COMP (Enhanced)
            // ─────────────────────────────────────────────
            {
                name: "ae_render_comp",
                description: "Add the active composition to the render queue and optionally start rendering.",
                inputSchema: {
                    type: "object",
                    properties: {
                        outputPath: { type: "string" },
                        startRender: { type: "boolean" },
                    },
                },
            },
            {
                name: "adobe_get_status",
                description: "Detect every connected Adobe host. Returns After Effects on port 3006 and Premiere Pro on port 3005.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "adobe_run_script",
                description: "Run ExtendScript in After Effects or Premiere Pro. With host=auto, the connected Adobe application is selected automatically.",
                inputSchema: {
                    type: "object",
                    properties: {
                        host: { type: "string", enum: ["auto", "after-effects", "premiere-pro"] },
                        code: { type: "string" },
                    },
                    required: ["code"],
                },
            },
            {
                name: "adobe_trigger",
                description: "Call a named function in the connected Adobe host. Automatically uses AeMCP in After Effects or PremiereMCP in Premiere Pro.",
                inputSchema: {
                    type: "object",
                    properties: {
                        host: { type: "string", enum: ["auto", "after-effects", "premiere-pro"] },
                        functionName: { type: "string", description: "Function name such as ping, getActiveSequence, or a fully-qualified host function" },
                        arguments: { type: "array", items: {} },
                    },
                    required: ["functionName"],
                },
            },
            {
                name: "ppro_get_status",
                description: "Get Premiere Pro bridge, project, and active sequence status from the unified Adobe MCP server.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ppro_run_script",
                description: "Execute arbitrary ExtendScript code in Premiere Pro through the unified Adobe MCP server.",
                inputSchema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
            },
            {
                name: "ppro_get_active_sequence",
                description: "Get the active Premiere Pro sequence.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ppro_get_clips",
                description: "Get clips from the active Premiere Pro timeline.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ppro_save_project",
                description: "Save the active Premiere Pro project.",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "ppro_open_project",
                description: "Open a Premiere Pro .prproj file.",
                inputSchema: { type: "object", properties: { filePath: { type: "string" } }, required: ["filePath"] },
            },
            {
                name: "ppro_close_project",
                description: "Close the active Premiere Pro project.",
                inputSchema: { type: "object", properties: { saveFirst: { type: "boolean" } } },
            },
            {
                name: "ppro_transcribe_groq",
                description: "Transcribe an audio/video file with Groq Whisper, generate an SRT, and optionally import it into Premiere Pro.",
                inputSchema: {
                    type: "object",
                    properties: {
                        mediaPath: { type: "string", description: "Absolute audio or video path" },
                        outputPath: { type: "string", description: "Optional absolute .srt output path" },
                        model: { type: "string" },
                        language: { type: "string" },
                        style: { type: "string", enum: ["word", "word_2", "tiktok", "phrase", "sentence"] },
                        casing: { type: "string", enum: ["uppercase", "gencaption", "lowercase", "titlecase"] },
                        stripPunctuation: { type: "boolean" },
                        apiKey: { type: "string", description: "Optional; GROQ_API_KEY environment variable is preferred" },
                        importToPremiere: { type: "boolean" },
                    },
                    required: ["mediaPath"],
                },
            },
            {
                name: "ppro_remove_silence",
                description: "Analyze source media and create/open a separate Premiere sequence named Silenced by default. The active source sequence is not edited. Render mode exports media only.",
                inputSchema: {
                    type: "object",
                    properties: {
                        mediaPath: { type: "string", description: "Absolute audio or video path" },
                        margin: { type: "number" },
                        threshold: { type: "string" },
                        mode: { type: "string", enum: ["premiere", "render"] },
                        sequenceName: { type: "string" },
                    },
                    required: ["mediaPath"],
                },
            },
            {
                name: "ppro_trigger_silencer",
                description: "Trigger Video Silencer on the selected Premiere source clip and create/open a separate Silenced sequence. No media path is required and the source sequence is not edited.",
                inputSchema: { type: "object", properties: { margin: { type: "number", description: "Speech padding in seconds; default 0.2" }, threshold: { type: "string", description: "Optional auto-editor audio threshold such as 4%" }, sequenceName: { type: "string", description: "New sequence name; default Silenced" } } },
            },
            {
                name: "ppro_trigger_transcriber",
                description: "Trigger Groq transcription from Premiere. By default exports the active sequence audio and imports captions; selected_clip transcribes only the selected source range.",
                inputSchema: { type: "object", properties: { scope: { type: "string", enum: ["active_sequence", "selected_clip"] }, outputPath: { type: "string" }, model: { type: "string" }, language: { type: "string" }, style: { type: "string", enum: ["word", "word_2", "tiktok", "phrase", "sentence"] }, casing: { type: "string", enum: ["uppercase", "gencaption", "lowercase", "titlecase"] }, stripPunctuation: { type: "boolean" }, apiKey: { type: "string", description: "Optional; GROQ_API_KEY environment variable is preferred" }, importToPremiere: { type: "boolean" } } },
            },
        ],
    };
});
// ═══════════════════════════════════════════════════════════════════
// TOOL CALL HANDLER — Route Every Tool to Its Builder
// ═══════════════════════════════════════════════════════════════════
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (premiereEditorTools.some(tool => tool.name === name)) {
        try {
            const result = await callPremiereEditor(name, args);
            return { isError: !result.success, content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        catch (error) {
            return { isError: true, content: [{ type: 'text', text: JSON.stringify({ success: false, error: String(error) }) }] };
        }
    }
    // Handle License Activation Call
    if (name === "ae_activate_license") {
        const key = args?.licenseKey;
        const res = licenseManager.activate(key);
        return {
            content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
    }
    if (name === "ae_connection_status") {
        return {
            content: [{ type: "text", text: JSON.stringify(aeBridge.getConnectionStatus(), null, 2) }],
        };
    }
    // Universal Adobe and Premiere tools are intentionally available before the
    // legacy AE license gate so one standards-compatible MCP install can route
    // to either host from any working directory.
    if (name === "adobe_get_status") {
        const result = await getAdobeStatus();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "adobe_run_script") {
        const input = args;
        const result = await runAdobeScript(input?.host || "auto", input?.code || "");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "adobe_trigger") {
        const input = args;
        const result = await triggerAdobeFunction(input?.host || "auto", input?.functionName || "", input?.arguments || []);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "ppro_run_script") {
        const result = await runAdobeScript("premiere-pro", args?.code || "");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "ppro_get_status") {
        const result = await runPremiereFunction("ping");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "ppro_get_active_sequence") {
        const result = await runPremiereFunction("getActiveSequence");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "ppro_get_clips") {
        const result = await runPremiereFunction("getClips");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "ppro_save_project") {
        const result = await runPremiereFunction("saveProject");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "ppro_open_project") {
        const result = await runPremiereFunction("openProject", [args?.filePath]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "ppro_close_project") {
        const result = await runPremiereFunction("closeProject", [Boolean(args?.saveFirst)]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (name === "ppro_transcribe_groq") {
        try {
            const result = await transcribeWithGroq(args);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, error: err?.message || String(err) }, null, 2) }] };
        }
    }
    if (name === "ppro_remove_silence") {
        try {
            const result = await removePremiereSilence(args);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, error: err?.message || String(err) }, null, 2) }] };
        }
    }
    if (name === "ppro_trigger_silencer") {
        try {
            const result = await triggerPremiereSilencer(args);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, error: err?.message || String(err) }, null, 2) }] };
        }
    }
    if (name === "ppro_trigger_transcriber") {
        try {
            const result = await triggerPremiereTranscriber(args);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, error: err?.message || String(err) }, null, 2) }] };
        }
    }
    // Enforce License Verification for all other tools
    if (!licenseManager.isActivated()) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: "UNLICENSED PRODUCT: Please enter your valid License Key in the After Effects Watcher UI (or call ae_activate_license). Format: AEMCP-XXXX-XXXX-XXXX",
                    }, null, 2),
                },
            ],
        };
    }
    try {
        let jsxCode = "";
        switch (name) {
            // ─── ORIGINAL TOOLS ───
            case "ae_create_comp":
                jsxCode = buildCreateCompJsx(args);
                break;
            case "ae_get_active_comp":
                jsxCode = buildGetActiveCompJsx();
                break;
            case "ae_get_preview": {
                const outPath = path.join(os.tmpdir(), `ae_preview_${Date.now()}.png`);
                jsxCode = buildSaveFramePreviewJsx({
                    compName: args?.compName,
                    time: args?.time,
                    outputPath: outPath,
                });
                break;
            }
            case "ae_get_user_requests": {
                const reqDir = path.join(os.tmpdir(), "ae-mcp-requests");
                const results = [];
                if (fs.existsSync(reqDir)) {
                    const files = fs.readdirSync(reqDir).filter((f) => f.startsWith("req_") && f.endsWith(".json"));
                    for (const file of files) {
                        const filePath = path.join(reqDir, file);
                        try {
                            const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                            results.push(data);
                            fs.unlinkSync(filePath);
                        }
                        catch (e) { }
                    }
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                count: results.length,
                                requests: results,
                                message: results.length > 0 ? "Retrieved user requests from AE Watcher UI" : "No pending user requests from AE watcher.",
                            }, null, 2),
                        },
                    ],
                };
            }
            case "ae_add_text_layer":
                jsxCode = buildAddTextLayerJsx(args);
                break;
            case "ae_add_solid_layer":
                jsxCode = buildAddSolidLayerJsx(args);
                break;
            case "ae_add_shape_layer":
                jsxCode = buildAddShapeLayerJsx(args);
                break;
            case "ae_set_transform":
                jsxCode = buildSetTransformJsx(args);
                break;
            case "ae_add_effect":
                jsxCode = buildAddEffectJsx(args);
                break;
            case "ae_set_expression":
                jsxCode = buildSetExpressionJsx(args);
                break;
            case "ae_set_easing":
                jsxCode = buildSetEasingJsx(args);
                break;
            case "ae_import_asset":
            case "ae_import_file":
                jsxCode = buildImportAssetJsx(args);
                break;
            case "ae_add_camera_layer":
                jsxCode = buildAddCameraLayerJsx(args);
                break;
            case "ae_add_light_layer":
                jsxCode = buildAddLightLayerJsx(args);
                break;
            case "ae_keyframe_assistant":
                jsxCode = buildKeyframeAssistantJsx(args);
                break;
            case "ae_precompose":
                jsxCode = buildPrecomposeJsx(args);
                break;
            case "ae_apply_color_palette":
                jsxCode = buildApplyColorPaletteJsx(args);
                break;
            case "ae_inspect_comp":
                jsxCode = buildInspectCompJsx(args?.compName);
                break;
            case "ae_apply_motion_preset":
                jsxCode = buildApplyMotionPresetJsx(args);
                break;
            case "ae_create_camera_rig":
                jsxCode = buildCreateCameraRigJsx(args?.compName);
                break;
            case "ae_export_video_preview":
                jsxCode = buildExportVideoPreviewJsx(args?.compName, args?.frameCount);
                break;
            case "ae_health_repair":
                jsxCode = buildHealthRepairJsx();
                break;
            case "ae_run_script":
                jsxCode = buildRunScriptJsx(args.code);
                break;
            case "ae_get_logs":
                jsxCode = buildGetLogsJsx();
                break;
            case "ae_live_report":
                jsxCode = buildGetLiveReportJsx();
                break;
            case "ae_delete_layer":
                jsxCode = buildDeleteLayerJsx(args);
                break;
            case "ae_duplicate_layer":
                jsxCode = buildDuplicateLayerJsx(args);
                break;
            case "ae_set_layer_timing":
                jsxCode = buildSetLayerTimingJsx(args);
                break;
            case "ae_render_comp": {
                // Enhanced render comp — uses original or render settings
                const outFile = args?.outputPath;
                jsxCode = `
(function() {
  try {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return { success: false, error: "No active comp" };
    var rqItem = app.project.renderQueue.items.add(comp);
    ${outFile ? `rqItem.outputModule(1).file = new File("${outFile.replace(/\\/g, "/")}");` : ""}
    ${args?.startRender ? `app.project.renderQueue.render();` : ""}
    return { success: true, compName: comp.name, status: ${args?.startRender ? '"rendering"' : '"queued"'} };
  } catch(err) { return { success: false, error: err.toString() }; }
})();
        `.trim();
                break;
            }
            // ─── PROJECT LIFECYCLE ───
            case "ae_project_open":
                jsxCode = buildOpenProjectJsx(args);
                break;
            case "ae_project_save":
                jsxCode = buildSaveProjectJsx(args);
                break;
            case "ae_project_close":
                jsxCode = buildCloseProjectJsx(args);
                break;
            case "ae_project_info":
                jsxCode = buildGetProjectInfoJsx();
                break;
            case "ae_project_collect_files":
                jsxCode = buildCollectFilesJsx(args);
                break;
            case "ae_project_increment_save":
                jsxCode = buildIncrementSaveJsx();
                break;
            // ─── COMPOSITION MANAGEMENT ───
            case "ae_comp_duplicate":
                jsxCode = buildDuplicateCompJsx(args);
                break;
            case "ae_comp_delete":
                jsxCode = buildDeleteCompJsx(args);
                break;
            case "ae_comp_settings":
                jsxCode = buildGetCompSettingsJsx(args);
                break;
            case "ae_comp_set_work_area":
                jsxCode = buildSetWorkAreaJsx(args);
                break;
            case "ae_comp_tree":
                jsxCode = buildGetCompTreeJsx(args?.compName);
                break;
            case "ae_comp_analyze":
                jsxCode = buildAnalyzeCompJsx(args?.compName);
                break;
            // ─── LAYER OPERATIONS ───
            case "ae_layer_split":
                jsxCode = buildSplitLayerJsx(args);
                break;
            case "ae_layer_flags":
                jsxCode = buildSetLayerFlagsJsx(args);
                break;
            case "ae_layer_parent":
                jsxCode = buildParentLayerJsx(args);
                break;
            case "ae_layer_blend_mode":
                jsxCode = buildSetBlendModeJsx(args);
                break;
            case "ae_layer_track_matte":
                jsxCode = buildSetTrackMatteJsx(args);
                break;
            case "ae_layer_reorder":
                jsxCode = buildReorderLayerJsx(args);
                break;
            case "ae_add_adjustment_layer":
                jsxCode = buildAddAdjustmentLayerJsx(args);
                break;
            case "ae_layer_time_reverse":
                jsxCode = buildTimeReverseLayerJsx(args);
                break;
            // ─── EFFECTS ENGINE ───
            case "ae_effect_remove":
                jsxCode = buildRemoveEffectJsx(args);
                break;
            case "ae_effect_toggle":
                jsxCode = buildToggleEffectJsx(args);
                break;
            case "ae_effect_set_property":
                jsxCode = buildSetEffectPropertyJsx(args);
                break;
            case "ae_effect_list_available":
                jsxCode = buildGetAvailableEffectsJsx();
                break;
            case "ae_set_layer_styles":
                jsxCode = buildSetLayerStylesJsx(args);
                break;
            // ─── KEYFRAME & ANIMATION ───
            case "ae_keyframe_bezier":
                jsxCode = buildSetBezierEasingJsx(args);
                break;
            case "ae_keyframe_copy_paste":
                jsxCode = buildCopyPasteKeyframesJsx(args);
                break;
            case "ae_keyframe_loop":
                jsxCode = buildLoopKeyframesJsx(args);
                break;
            case "ae_keyframe_delete":
                jsxCode = buildDeleteKeyframesJsx(args);
                break;
            case "ae_keyframe_roving":
                jsxCode = buildSetRovingKeyframesJsx(args);
                break;
            // ─── EXPRESSIONS ───
            case "ae_expression_validate":
                jsxCode = buildValidateExpressionJsx(args);
                break;
            case "ae_expression_toggle":
                jsxCode = buildToggleExpressionJsx(args);
                break;
            case "ae_expression_library":
                jsxCode = buildExpressionLibraryJsx(args);
                break;
            // ─── ASSET PIPELINE ───
            case "ae_import_asset_advanced":
                jsxCode = buildImportAssetAdvancedJsx(args);
                break;
            case "ae_import_folder":
                jsxCode = buildImportFolderJsx(args);
                break;
            case "ae_replace_footage":
                jsxCode = buildReplaceFootageJsx(args);
                break;
            case "ae_interpret_footage":
                jsxCode = buildInterpretFootageJsx(args);
                break;
            case "ae_set_footage_proxy":
                jsxCode = buildSetFootageProxyJsx(args);
                break;
            // ─── RENDER PIPELINE ───
            case "ae_set_motion_blur":
                jsxCode = buildSetMotionBlurJsx(args);
                break;
            case "ae_set_render_settings":
                jsxCode = buildSetRenderSettingsJsx(args);
                break;
            case "ae_render_status":
                jsxCode = buildGetRenderStatusJsx();
                break;
            case "ae_render_start":
                jsxCode = buildStartRenderJsx();
                break;
            case "ae_render_cancel":
                jsxCode = buildCancelRenderJsx();
                break;
            case "ae_set_color_settings":
                jsxCode = buildSetColorSettingsJsx(args);
                break;
            case "ae_apply_lut":
                jsxCode = buildApplyLutJsx(args);
                break;
            // ─── AI-NATIVE FEATURES ───
            case "ae_describe_comp":
                jsxCode = buildDescribeCompJsx(args?.compName);
                break;
            case "ae_find_layer":
                jsxCode = buildFindLayerJsx(args);
                break;
            case "ae_template_create":
                jsxCode = buildCreateTemplateJsx(args);
                break;
            case "ae_template_load":
                jsxCode = buildLoadTemplateJsx(args);
                break;
            case "ae_batch_compose":
                jsxCode = buildBatchComposeJsx(args);
                break;
            // ─── SYSTEM, SAFETY & MONITORING ───
            case "ae_system_info":
                jsxCode = buildGetSystemInfoJsx();
                break;
            case "ae_memory_cleanup":
                jsxCode = buildMemoryCleanupJsx();
                break;
            case "ae_plugin_inventory":
                jsxCode = buildGetPluginInventoryJsx();
                break;
            case "ae_undo":
                jsxCode = buildUndoJsx(args);
                break;
            case "ae_check_render_feasibility":
                jsxCode = buildCheckRenderFeasibilityJsx(args?.compName);
                break;
            case "ae_project_diff":
                jsxCode = buildProjectDiffJsx();
                break;
            // ─── MASKS ───
            case "ae_mask_add":
                jsxCode = buildAddMaskJsx(args);
                break;
            case "ae_mask_animate":
                jsxCode = buildAnimateMaskJsx(args);
                break;
            // ─── TEXT TOOLS ───
            case "ae_text_update":
                jsxCode = buildTextUpdateJsx(args);
                break;
            case "ae_text_to_shapes":
                jsxCode = buildTextToShapesJsx(args);
                break;
            default:
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: false, error: `Unknown tool name: ${name}` }),
                        },
                    ],
                };
        }
        const result = await aeBridge.executeJsx(jsxCode);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ success: false, error: error.message || String(error) }),
                },
            ],
        };
    }
});
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Uniprae v2.2.0 running on stdio — After Effects and Premiere Pro tools active.");
}
run().catch((err) => {
    console.error("Fatal error starting After Effects MCP server:", err);
    process.exit(1);
});
