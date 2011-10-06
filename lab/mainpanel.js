
WebInspector.TextViewer = function(textModel, platform, url, delegate)
{
WebInspector.View.call(this);

this._textModel = textModel;
this._textModel.changeListener = this._textChanged.bind(this);
this._textModel.resetUndoStack();
this._delegate = delegate;

this.element.className = "text-editor monospace";

var enterTextChangeMode = this._enterInternalTextChangeMode.bind(this);
var exitTextChangeMode = this._exitInternalTextChangeMode.bind(this);
var syncScrollListener = this._syncScroll.bind(this);
var syncDecorationsForLineListener = this._syncDecorationsForLine.bind(this);
var syncLineHeightListener = this._syncLineHeight.bind(this);
this._mainPanel = new WebInspector.TextEditorMainPanel(this._textModel, url, syncScrollListener, syncDecorationsForLineListener, enterTextChangeMode, exitTextChangeMode);
this._gutterPanel = new WebInspector.TextEditorGutterPanel(this._textModel, syncDecorationsForLineListener, syncLineHeightListener);
this.element.appendChild(this._mainPanel.element);
this.element.appendChild(this._gutterPanel.element);


this._gutterPanel.element.addEventListener("mousewheel", function(e) {
this._mainPanel.element.dispatchEvent(e);
}.bind(this), false);

this.element.addEventListener("dblclick", this._doubleClick.bind(this), true);
this.element.addEventListener("keydown", this._handleKeyDown.bind(this), false);
this.element.addEventListener("contextmenu", this._contextMenu.bind(this), true);

this._registerShortcuts();
}

WebInspector.TextViewer.prototype = {
set mimeType(mimeType)
{
this._mainPanel.mimeType = mimeType;
},

set readOnly(readOnly)
{
if (this._mainPanel.readOnly === readOnly)
return;
this._mainPanel.readOnly = readOnly;
},

get readOnly()
{
return this._mainPanel.readOnly;
},

get textModel()
{
return this._textModel;
},

revealLine: function(lineNumber)
{
this._mainPanel.revealLine(lineNumber);
},

addDecoration: function(lineNumber, decoration)
{
this._mainPanel.addDecoration(lineNumber, decoration);
this._gutterPanel.addDecoration(lineNumber, decoration);
},

removeDecoration: function(lineNumber, decoration)
{
this._mainPanel.removeDecoration(lineNumber, decoration);
this._gutterPanel.removeDecoration(lineNumber, decoration);
},

markAndRevealRange: function(range)
{
this._mainPanel.markAndRevealRange(range);
},

highlightLine: function(lineNumber)
{
if (typeof lineNumber !== "number" || lineNumber < 0)
return;

lineNumber = Math.min(lineNumber, this._textModel.linesCount - 1);
this._mainPanel.highlightLine(lineNumber);
},

clearLineHighlight: function()
{
this._mainPanel.clearLineHighlight();
},

freeCachedElements: function()
{
this._mainPanel.freeCachedElements();
this._gutterPanel.freeCachedElements();
},

get scrollTop()
{
return this._mainPanel.element.scrollTop;
},

set scrollTop(scrollTop)
{
this._mainPanel.element.scrollTop = scrollTop;
},

get scrollLeft()
{
return this._mainPanel.element.scrollLeft;
},

set scrollLeft(scrollLeft)
{
this._mainPanel.element.scrollLeft = scrollLeft;
},

beginUpdates: function()
{
this._mainPanel.beginUpdates();
this._gutterPanel.beginUpdates();
},

endUpdates: function()
{
this._mainPanel.endUpdates();
this._gutterPanel.endUpdates();
this._updatePanelOffsets();
},

resize: function()
{
this._mainPanel.resize();
this._gutterPanel.resize();
this._updatePanelOffsets();
},


_textChanged: function(oldRange, newRange, oldText, newText)
{
if (!this._internalTextChangeMode)
this._textModel.resetUndoStack();
this._mainPanel.textChanged(oldRange, newRange);
this._gutterPanel.textChanged(oldRange, newRange);
this._updatePanelOffsets();
},

_enterInternalTextChangeMode: function()
{
this._internalTextChangeMode = true;
this._delegate.beforeTextChanged();
},

_exitInternalTextChangeMode: function(oldRange, newRange)
{
this._internalTextChangeMode = false;
this._delegate.afterTextChanged(oldRange, newRange);
},

_updatePanelOffsets: function()
{
var lineNumbersWidth = this._gutterPanel.element.offsetWidth;
if (lineNumbersWidth)
this._mainPanel.element.style.setProperty("left", lineNumbersWidth + "px");
else
this._mainPanel.element.style.removeProperty("left"); 
},

_syncScroll: function()
{

setTimeout(function() {
var mainElement = this._mainPanel.element;
var gutterElement = this._gutterPanel.element;

this._gutterPanel.syncClientHeight(mainElement.clientHeight);
gutterElement.scrollTop = mainElement.scrollTop;
}.bind(this), 0);
},

_syncDecorationsForLine: function(lineNumber)
{
if (lineNumber >= this._textModel.linesCount)
return;

var mainChunk = this._mainPanel.chunkForLine(lineNumber);
if (mainChunk.linesCount === 1 && mainChunk.decorated) {
var gutterChunk = this._gutterPanel.makeLineAChunk(lineNumber);
var height = mainChunk.height;
if (height)
gutterChunk.element.style.setProperty("height", height + "px");
else
gutterChunk.element.style.removeProperty("height");
} else {
var gutterChunk = this._gutterPanel.chunkForLine(lineNumber);
if (gutterChunk.linesCount === 1)
gutterChunk.element.style.removeProperty("height");
}
},

_syncLineHeight: function(gutterRow) {
if (this._lineHeightSynced)
return;
if (gutterRow && gutterRow.offsetHeight) {

this.element.style.setProperty("line-height", gutterRow.offsetHeight + "px");
this._lineHeightSynced = true;
}
},

_doubleClick: function(event)
{
if (!this.readOnly)
return;

var lineRow = event.target.enclosingNodeOrSelfWithClass("webkit-line-content");
if (!lineRow)
return;  

this._delegate.doubleClick(lineRow.lineNumber);
window.getSelection().collapseToStart();
},

_registerShortcuts: function()
{
var keys = WebInspector.KeyboardShortcut.Keys;
var modifiers = WebInspector.KeyboardShortcut.Modifiers;

this._shortcuts = {};
var commitEditing = this._commitEditing.bind(this);
var cancelEditing = this._cancelEditing.bind(this);
this._shortcuts[WebInspector.KeyboardShortcut.makeKey("s", modifiers.CtrlOrMeta)] = commitEditing;
this._shortcuts[WebInspector.KeyboardShortcut.makeKey(keys.Enter.code, modifiers.CtrlOrMeta)] = commitEditing;
this._shortcuts[WebInspector.KeyboardShortcut.makeKey(keys.Esc.code)] = cancelEditing;

var handleUndo = this._mainPanel.handleUndoRedo.bind(this._mainPanel, false);
var handleRedo = this._mainPanel.handleUndoRedo.bind(this._mainPanel, true);
this._shortcuts[WebInspector.KeyboardShortcut.makeKey("z", modifiers.CtrlOrMeta)] = handleUndo;
this._shortcuts[WebInspector.KeyboardShortcut.makeKey("z", modifiers.Shift | modifiers.CtrlOrMeta)] = handleRedo;

var handleTabKey = this._mainPanel.handleTabKeyPress.bind(this._mainPanel, false);
var handleShiftTabKey = this._mainPanel.handleTabKeyPress.bind(this._mainPanel, true);
this._shortcuts[WebInspector.KeyboardShortcut.makeKey(keys.Tab.code)] = handleTabKey;
this._shortcuts[WebInspector.KeyboardShortcut.makeKey(keys.Tab.code, modifiers.Shift)] = handleShiftTabKey;
},

_handleKeyDown: function(e)
{
var shortcutKey = WebInspector.KeyboardShortcut.makeKeyFromEvent(e);
var handler = this._shortcuts[shortcutKey];
if (handler && handler.call(this)) {
e.preventDefault();
e.stopPropagation();
}
},

_contextMenu: function(event)
{
var contextMenu = new WebInspector.ContextMenu();
var target = event.target.enclosingNodeOrSelfWithClass("webkit-line-number");
if (target)
this._delegate.populateLineGutterContextMenu(target.lineNumber, contextMenu);
else {
var selection = this._mainPanel._getSelection();
if (selection && !selection.isEmpty())
return; 
this._delegate.populateTextAreaContextMenu(contextMenu);
}

var fileName = this._delegate.suggestedFileName();
if (fileName)
contextMenu.appendItem(WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Save as..." : "Save As..."), InspectorFrontendHost.saveAs.bind(InspectorFrontendHost, fileName, this._textModel.text));

contextMenu.show(event);
},

_commitEditing: function()
{
if (this.readOnly)
return false;

this._delegate.commitEditing();
return true;
},

_cancelEditing: function()
{
if (this.readOnly)
return false;

this._delegate.cancelEditing();
return true;
}
}