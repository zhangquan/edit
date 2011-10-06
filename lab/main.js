
WebInspector.TextEditorMainPanel = function(textModel, url, syncScrollListener, syncDecorationsForLineListener, enterTextChangeMode, exitTextChangeMode)
{
WebInspector.TextEditorChunkedPanel.call(this, textModel);

this._syncScrollListener = syncScrollListener;
this._syncDecorationsForLineListener = syncDecorationsForLineListener;
this._enterTextChangeMode = enterTextChangeMode;
this._exitTextChangeMode = exitTextChangeMode;

this._url = url;
this._highlighter = new WebInspector.TextEditorHighlighter(textModel, this._highlightDataReady.bind(this));
this._readOnly = true;

this.element = document.createElement("div");
this.element.className = "text-editor-contents";
this.element.tabIndex = 0;

this._container = document.createElement("div");
this._container.className = "inner-container";
this._container.tabIndex = 0;
this.element.appendChild(this._container);

this.element.addEventListener("scroll", this._scroll.bind(this), false);









this._handleDOMUpdatesCallback = this._handleDOMUpdates.bind(this);
this._container.addEventListener("DOMCharacterDataModified", this._handleDOMUpdatesCallback, false);
this._container.addEventListener("DOMNodeInserted", this._handleDOMUpdatesCallback, false);
this._container.addEventListener("DOMSubtreeModified", this._handleDOMUpdatesCallback, false);

this.freeCachedElements();
this._buildChunks();
}

WebInspector.TextEditorMainPanel.prototype = {
set mimeType(mimeType)
{
this._highlighter.mimeType = mimeType;
},

set readOnly(readOnly)
{
if (this._readOnly === readOnly)
return;

this.beginDomUpdates();
this._readOnly = readOnly;
if (this._readOnly)
this._container.removeStyleClass("text-editor-editable");
else
this._container.addStyleClass("text-editor-editable");
this.endDomUpdates();
},

get readOnly()
{
return this._readOnly;
},

setEditableRange: function(startLine, endLine)
{
this.beginDomUpdates();

var firstChunkNumber = this._chunkNumberForLine(startLine);
var firstChunk = this._textChunks[firstChunkNumber];
if (firstChunk.startLine !== startLine) {
this._splitChunkOnALine(startLine, firstChunkNumber);
firstChunkNumber += 1;
}

var lastChunkNumber = this._textChunks.length;
if (endLine !== this._textModel.linesCount) {
lastChunkNumber = this._chunkNumberForLine(endLine);
var lastChunk = this._textChunks[lastChunkNumber];
if (lastChunk && lastChunk.startLine !== endLine) {
this._splitChunkOnALine(endLine, lastChunkNumber);
lastChunkNumber += 1;
}
}

for (var chunkNumber = 0; chunkNumber < firstChunkNumber; ++chunkNumber)
this._textChunks[chunkNumber].readOnly = true;
for (var chunkNumber = firstChunkNumber; chunkNumber < lastChunkNumber; ++chunkNumber)
this._textChunks[chunkNumber].readOnly = false;
for (var chunkNumber = lastChunkNumber; chunkNumber < this._textChunks.length; ++chunkNumber)
this._textChunks[chunkNumber].readOnly = true;

this.endDomUpdates();
},

clearEditableRange: function()
{
for (var chunkNumber = 0; chunkNumber < this._textChunks.length; ++chunkNumber)
this._textChunks[chunkNumber].readOnly = false;
},

markAndRevealRange: function(range)
{
if (this._rangeToMark) {
var markedLine = this._rangeToMark.startLine;
delete this._rangeToMark;

if (!this._dirtyLines) {
this.beginDomUpdates();
var chunk = this.chunkForLine(markedLine);
var wasExpanded = chunk.expanded;
chunk.expanded = false;
chunk.updateCollapsedLineRow();
chunk.expanded = wasExpanded;
this.endDomUpdates();
} else
this._paintLines(markedLine, markedLine + 1);
}

if (range) {
this._rangeToMark = range;
this.revealLine(range.startLine);
var chunk = this.makeLineAChunk(range.startLine);
this._paintLine(chunk.element);
if (this._markedRangeElement)
this._markedRangeElement.scrollIntoViewIfNeeded();
}
delete this._markedRangeElement;
},

highlightLine: function(lineNumber)
{
this.clearLineHighlight();
this._highlightedLine = lineNumber;
this.revealLine(lineNumber);
this.addDecoration(lineNumber, "webkit-highlighted-line");
},

clearLineHighlight: function()
{
if (typeof this._highlightedLine === "number") {
this.removeDecoration(this._highlightedLine, "webkit-highlighted-line");
delete this._highlightedLine;
}
},

freeCachedElements: function()
{
this._cachedSpans = [];
this._cachedTextNodes = [];
this._cachedRows = [];
},

handleUndoRedo: function(redo)
{
if (this._readOnly || this._dirtyLines)
return false;

this.beginUpdates();
this._enterTextChangeMode();

var callback = function(oldRange, newRange) {
this._exitTextChangeMode(oldRange, newRange);
this._enterTextChangeMode();
}.bind(this);

var range = redo ? this._textModel.redo(callback) : this._textModel.undo(callback);
if (range)
this._setCaretLocation(range.endLine, range.endColumn, true);

this._exitTextChangeMode(null, null);
this.endUpdates();

return true;
},

handleTabKeyPress: function(shiftKey)
{
if (this._readOnly || this._dirtyLines)
return false;

var selection = this._getSelection();
if (!selection)
return false;

if (shiftKey)
return true;

this.beginUpdates();
this._enterTextChangeMode();

var range = selection;
if (range.startLine > range.endLine || (range.startLine === range.endLine && range.startColumn > range.endColumn))
range = new WebInspector.TextRange(range.endLine, range.endColumn, range.startLine, range.startColumn);

var newRange = this._setText(range, "\t");

this._exitTextChangeMode(range, newRange);
this.endUpdates();

this._setCaretLocation(newRange.endLine, newRange.endColumn, true);
return true;
},

_splitChunkOnALine: function(lineNumber, chunkNumber, createSuffixChunk)
{
var selection = this._getSelection();
var chunk = WebInspector.TextEditorChunkedPanel.prototype._splitChunkOnALine.call(this, lineNumber, chunkNumber, createSuffixChunk);
this._restoreSelection(selection);
return chunk;
},

beginDomUpdates: function()
{
WebInspector.TextEditorChunkedPanel.prototype.beginDomUpdates.call(this);
if (this._domUpdateCoalescingLevel === 1) {
this._container.removeEventListener("DOMCharacterDataModified", this._handleDOMUpdatesCallback, false);
this._container.removeEventListener("DOMNodeInserted", this._handleDOMUpdatesCallback, false);
this._container.removeEventListener("DOMSubtreeModified", this._handleDOMUpdatesCallback, false);
}
},

endDomUpdates: function()
{
WebInspector.TextEditorChunkedPanel.prototype.endDomUpdates.call(this);
if (this._domUpdateCoalescingLevel === 0) {
this._container.addEventListener("DOMCharacterDataModified", this._handleDOMUpdatesCallback, false);
this._container.addEventListener("DOMNodeInserted", this._handleDOMUpdatesCallback, false);
this._container.addEventListener("DOMSubtreeModified", this._handleDOMUpdatesCallback, false);
}
},

_enableDOMNodeRemovedListener: function(lineRow, enable)
{
if (enable)
lineRow.addEventListener("DOMNodeRemoved", this._handleDOMUpdatesCallback, false);
else
lineRow.removeEventListener("DOMNodeRemoved", this._handleDOMUpdatesCallback, false);
},

_buildChunks: function()
{
for (var i = 0; i < this._textModel.linesCount; ++i)
this._textModel.removeAttribute(i, "highlight");

WebInspector.TextEditorChunkedPanel.prototype._buildChunks.call(this);
},

_createNewChunk: function(startLine, endLine)
{
return new WebInspector.TextEditorMainChunk(this, startLine, endLine);
},

_expandChunks: function(fromIndex, toIndex)
{
var lastChunk = this._textChunks[toIndex - 1];
var lastVisibleLine = lastChunk.startLine + lastChunk.linesCount;

var selection = this._getSelection();

this._muteHighlightListener = true;
this._highlighter.highlight(lastVisibleLine);
delete this._muteHighlightListener;

this._restorePaintLinesOperationsCredit();
WebInspector.TextEditorChunkedPanel.prototype._expandChunks.call(this, fromIndex, toIndex);
this._adjustPaintLinesOperationsRefreshValue();

this._restoreSelection(selection);
},

_highlightDataReady: function(fromLine, toLine)
{
if (this._muteHighlightListener)
return;
this._restorePaintLinesOperationsCredit();
this._paintLines(fromLine, toLine, true  );
},

_schedulePaintLines: function(startLine, endLine)
{
if (startLine >= endLine)
return;

if (!this._scheduledPaintLines) {
this._scheduledPaintLines = [ { startLine: startLine, endLine: endLine } ];
this._paintScheduledLinesTimer = setTimeout(this._paintScheduledLines.bind(this), 0);
} else {
for (var i = 0; i < this._scheduledPaintLines.length; ++i) {
var chunk = this._scheduledPaintLines[i];
if (chunk.startLine <= endLine && chunk.endLine >= startLine) {
chunk.startLine = Math.min(chunk.startLine, startLine);
chunk.endLine = Math.max(chunk.endLine, endLine);
return;
}
if (chunk.startLine > endLine) {
this._scheduledPaintLines.splice(i, 0, { startLine: startLine, endLine: endLine });
return;
}
}
this._scheduledPaintLines.push({ startLine: startLine, endLine: endLine });
}
},

_paintScheduledLines: function(skipRestoreSelection)
{
if (this._paintScheduledLinesTimer)
clearTimeout(this._paintScheduledLinesTimer);
delete this._paintScheduledLinesTimer;

if (!this._scheduledPaintLines)
return;


if (this._dirtyLines || this._repaintAllTimer) {
this._paintScheduledLinesTimer = setTimeout(this._paintScheduledLines.bind(this), 50);
return;
}

var scheduledPaintLines = this._scheduledPaintLines;
delete this._scheduledPaintLines;

this._restorePaintLinesOperationsCredit();
this._paintLineChunks(scheduledPaintLines, !skipRestoreSelection);
this._adjustPaintLinesOperationsRefreshValue();
},

_restorePaintLinesOperationsCredit: function()
{
if (!this._paintLinesOperationsRefreshValue)
this._paintLinesOperationsRefreshValue = 250;
this._paintLinesOperationsCredit = this._paintLinesOperationsRefreshValue;
this._paintLinesOperationsLastRefresh = Date.now();
},

_adjustPaintLinesOperationsRefreshValue: function()
{
var operationsDone = this._paintLinesOperationsRefreshValue - this._paintLinesOperationsCredit;
if (operationsDone <= 0)
return;
var timePast = Date.now() - this._paintLinesOperationsLastRefresh;
if (timePast <= 0)
return;

var value = Math.floor(operationsDone / timePast * 50);
this._paintLinesOperationsRefreshValue = Number.constrain(value, 150, 1500);
},

_paintLines: function(fromLine, toLine, restoreSelection)
{
this._paintLineChunks([ { startLine: fromLine, endLine: toLine } ], restoreSelection);
},

_paintLineChunks: function(lineChunks, restoreSelection)
{


var visibleFrom = this.element.scrollTop;
var firstVisibleLineNumber = this._findFirstVisibleLineNumber(visibleFrom);

var chunk;
var selection;
var invisibleLineRows = [];
for (var i = 0; i < lineChunks.length; ++i) {
var lineChunk = lineChunks[i];
if (this._dirtyLines || this._scheduledPaintLines) {
this._schedulePaintLines(lineChunk.startLine, lineChunk.endLine);
continue;
}
for (var lineNumber = lineChunk.startLine; lineNumber < lineChunk.endLine; ++lineNumber) {
if (!chunk || lineNumber < chunk.startLine || lineNumber >= chunk.startLine + chunk.linesCount)
chunk = this.chunkForLine(lineNumber);
var lineRow = chunk.getExpandedLineRow(lineNumber);
if (!lineRow)
continue;
if (lineNumber < firstVisibleLineNumber) {
invisibleLineRows.push(lineRow);
continue;
}
if (restoreSelection && !selection)
selection = this._getSelection();
this._paintLine(lineRow);
if (this._paintLinesOperationsCredit < 0) {
this._schedulePaintLines(lineNumber + 1, lineChunk.endLine);
break;
}
}
}

for (var i = 0; i < invisibleLineRows.length; ++i) {
if (restoreSelection && !selection)
selection = this._getSelection();
this._paintLine(invisibleLineRows[i]);
}

if (restoreSelection)
this._restoreSelection(selection);
},

_paintLine: function(lineRow)
{
var lineNumber = lineRow.lineNumber;
if (this._dirtyLines) {
this._schedulePaintLines(lineNumber, lineNumber + 1);
return;
}

this.beginDomUpdates();
try {
if (this._scheduledPaintLines || this._paintLinesOperationsCredit < 0) {
this._schedulePaintLines(lineNumber, lineNumber + 1);
return;
}

var highlight = this._textModel.getAttribute(lineNumber, "highlight");
if (!highlight)
return;

lineRow.removeChildren();
var line = this._textModel.line(lineNumber);
if (!line)
lineRow.appendChild(document.createElement("br"));

var plainTextStart = -1;
for (var j = 0; j < line.length;) {
if (j > 1000) {

if (plainTextStart === -1)
plainTextStart = j;
break;
}
var attribute = highlight[j];
if (!attribute || !attribute.tokenType) {
if (plainTextStart === -1)
plainTextStart = j;
j++;
} else {
if (plainTextStart !== -1) {
this._appendTextNode(lineRow, line.substring(plainTextStart, j));
plainTextStart = -1;
--this._paintLinesOperationsCredit;
}
this._appendSpan(lineRow, line.substring(j, j + attribute.length), attribute.tokenType);
j += attribute.length;
--this._paintLinesOperationsCredit;
}
}
if (plainTextStart !== -1) {
this._appendTextNode(lineRow, line.substring(plainTextStart, line.length));
--this._paintLinesOperationsCredit;
}
if (lineRow.decorationsElement)
lineRow.appendChild(lineRow.decorationsElement);
} finally {
if (this._rangeToMark && this._rangeToMark.startLine === lineNumber)
this._markedRangeElement = highlightSearchResult(lineRow, this._rangeToMark.startColumn, this._rangeToMark.endColumn - this._rangeToMark.startColumn);
this.endDomUpdates();
}
},

_releaseLinesHighlight: function(lineRow)
{
if (!lineRow)
return;
if ("spans" in lineRow) {
var spans = lineRow.spans;
for (var j = 0; j < spans.length; ++j)
this._cachedSpans.push(spans[j]);
delete lineRow.spans;
}
if ("textNodes" in lineRow) {
var textNodes = lineRow.textNodes;
for (var j = 0; j < textNodes.length; ++j)
this._cachedTextNodes.push(textNodes[j]);
delete lineRow.textNodes;
}
this._cachedRows.push(lineRow);
},

_getSelection: function()
{
var selection = window.getSelection();
if (!selection.rangeCount)
return null;
var selectionRange = selection.getRangeAt(0);

if (!this._container.isAncestor(selectionRange.startContainer) || !this._container.isAncestor(selectionRange.endContainer))
return null;
var start = this._selectionToPosition(selectionRange.startContainer, selectionRange.startOffset);
var end = selectionRange.collapsed ? start : this._selectionToPosition(selectionRange.endContainer, selectionRange.endOffset);
if (selection.anchorNode === selectionRange.startContainer && selection.anchorOffset === selectionRange.startOffset)
return new WebInspector.TextRange(start.line, start.column, end.line, end.column);
else
return new WebInspector.TextRange(end.line, end.column, start.line, start.column);
},

_restoreSelection: function(range, scrollIntoView)
{
if (!range)
return;
var start = this._positionToSelection(range.startLine, range.startColumn);
var end = range.isEmpty() ? start : this._positionToSelection(range.endLine, range.endColumn);
window.getSelection().setBaseAndExtent(start.container, start.offset, end.container, end.offset);

if (scrollIntoView) {
for (var node = end.container; node; node = node.parentElement) {
if (node.scrollIntoViewIfNeeded) {
node.scrollIntoViewIfNeeded();
break;
}
}
}
},

_setCaretLocation: function(line, column, scrollIntoView)
{
var range = new WebInspector.TextRange(line, column, line, column);
this._restoreSelection(range, scrollIntoView);
},

_selectionToPosition: function(container, offset)
{
if (container === this._container && offset === 0)
return { line: 0, column: 0 };
if (container === this._container && offset === 1)
return { line: this._textModel.linesCount - 1, column: this._textModel.lineLength(this._textModel.linesCount - 1) };

var lineRow = this._enclosingLineRowOrSelf(container);
var lineNumber = lineRow.lineNumber;
if (container === lineRow && offset === 0)
return { line: lineNumber, column: 0 };


var column = 0;
var node = lineRow.nodeType === Node.TEXT_NODE ? lineRow : lineRow.traverseNextTextNode(lineRow);
while (node && node !== container) {
var text = node.textContent;
for (var i = 0; i < text.length; ++i) {
if (text.charAt(i) === "\n") {
lineNumber++;
column = 0;
} else
column++;
}
node = node.traverseNextTextNode(lineRow);
}

if (node === container && offset) {
var text = node.textContent;
for (var i = 0; i < offset; ++i) {
if (text.charAt(i) === "\n") {
lineNumber++;
column = 0;
} else
column++;
}
}
return { line: lineNumber, column: column };
},

_positionToSelection: function(line, column)
{
var chunk = this.chunkForLine(line);

var lineRow = chunk.linesCount === 1 ? chunk.element : chunk.getExpandedLineRow(line);
if (lineRow)
var rangeBoundary = lineRow.rangeBoundaryForOffset(column);
else {
var offset = column;
for (var i = chunk.startLine; i < line; ++i)
offset += this._textModel.lineLength(i) + 1; 
lineRow = chunk.element;
if (lineRow.firstChild)
var rangeBoundary = { container: lineRow.firstChild, offset: offset };
else
var rangeBoundary = { container: lineRow, offset: 0 };
}
return rangeBoundary;
},

_enclosingLineRowOrSelf: function(element)
{
var lineRow = element.enclosingNodeOrSelfWithClass("webkit-line-content");
if (lineRow)
return lineRow;
for (var lineRow = element; lineRow; lineRow = lineRow.parentElement) {
if (lineRow.parentElement === this._container)
return lineRow;
}
return null;
},

_appendSpan: function(element, content, className)
{
if (className === "html-resource-link" || className === "html-external-link") {
element.appendChild(this._createLink(content, className === "html-external-link"));
return;
}

var span = this._cachedSpans.pop() || document.createElement("span");
span.className = "webkit-" + className;
span.textContent = content;
element.appendChild(span);
if (!("spans" in element))
element.spans = [];
element.spans.push(span);
},

_appendTextNode: function(element, text)
{
var textNode = this._cachedTextNodes.pop();
if (textNode)
textNode.nodeValue = text;
else
textNode = document.createTextNode(text);
element.appendChild(textNode);
if (!("textNodes" in element))
element.textNodes = [];
element.textNodes.push(textNode);
},

_createLink: function(content, isExternal)
{
var quote = content.charAt(0);
if (content.length > 1 && (quote === "\"" ||   quote === "'"))
content = content.substring(1, content.length - 1);
else
quote = null;

var a = WebInspector.linkifyURLAsNode(this._rewriteHref(content), content, null, isExternal);
var span = document.createElement("span");
span.className = "webkit-html-attribute-value";
if (quote)
span.appendChild(document.createTextNode(quote));
span.appendChild(a);
if (quote)
span.appendChild(document.createTextNode(quote));
return span;
},

_rewriteHref: function(hrefValue, isExternal)
{
if (!this._url || !hrefValue || hrefValue.indexOf("://") > 0)
return hrefValue;
return WebInspector.completeURL(this._url, hrefValue);
},

_handleDOMUpdates: function(e)
{
if (this._domUpdateCoalescingLevel)
return;

var target = e.target;
if (target === this._container)
return;

var lineRow = this._enclosingLineRowOrSelf(target);
if (!lineRow)
return;

if (lineRow.decorationsElement && (lineRow.decorationsElement === target || lineRow.decorationsElement.isAncestor(target))) {
if (this._syncDecorationsForLineListener)
this._syncDecorationsForLineListener(lineRow.lineNumber);
return;
}

if (this._readOnly)
return;

if (target === lineRow && e.type === "DOMNodeInserted") {

delete lineRow.lineNumber;
}

var startLine = 0;
for (var row = lineRow; row; row = row.previousSibling) {
if (typeof row.lineNumber === "number") {
startLine = row.lineNumber;
break;
}
}

var endLine = startLine + 1;
for (var row = lineRow.nextSibling; row; row = row.nextSibling) {
if (typeof row.lineNumber === "number" && row.lineNumber > startLine) {
endLine = row.lineNumber;
break;
}
}

if (target === lineRow && e.type === "DOMNodeRemoved") {

delete lineRow.lineNumber;
}

if (this._dirtyLines) {
this._dirtyLines.start = Math.min(this._dirtyLines.start, startLine);
this._dirtyLines.end = Math.max(this._dirtyLines.end, endLine);
} else {
this._dirtyLines = { start: startLine, end: endLine };
setTimeout(this._applyDomUpdates.bind(this), 0);

this.markAndRevealRange(null);
}
},

_applyDomUpdates: function()
{
if (!this._dirtyLines)
return;


if (this._readOnly) {
delete this._dirtyLines;
return;
}


this._enterTextChangeMode();

var dirtyLines = this._dirtyLines;
delete this._dirtyLines;

var firstChunkNumber = this._chunkNumberForLine(dirtyLines.start);
var startLine = this._textChunks[firstChunkNumber].startLine;
var endLine = this._textModel.linesCount;


var firstLineRow;
if (firstChunkNumber) {
var chunk = this._textChunks[firstChunkNumber - 1];
firstLineRow = chunk.expanded ? chunk.getExpandedLineRow(chunk.startLine + chunk.linesCount - 1) : chunk.element;
firstLineRow = firstLineRow.nextSibling;
} else
firstLineRow = this._container.firstChild;

var lines = [];
for (var lineRow = firstLineRow; lineRow; lineRow = lineRow.nextSibling) {
if (typeof lineRow.lineNumber === "number" && lineRow.lineNumber >= dirtyLines.end) {
endLine = lineRow.lineNumber;
break;
}

lineRow.lineNumber = startLine + lines.length;
this._collectLinesFromDiv(lines, lineRow);
}


var startOffset = 0;
while (startLine < dirtyLines.start && startOffset < lines.length) {
if (this._textModel.line(startLine) !== lines[startOffset])
break;
++startOffset;
++startLine;
}

var endOffset = lines.length;
while (endLine > dirtyLines.end && endOffset > startOffset) {
if (this._textModel.line(endLine - 1) !== lines[endOffset - 1])
break;
--endOffset;
--endLine;
}

lines = lines.slice(startOffset, endOffset);


var startColumn = 0;
var endColumn = this._textModel.lineLength(endLine - 1);
if (lines.length > 0) {
var line1 = this._textModel.line(startLine);
var line2 = lines[0];
while (line1[startColumn] && line1[startColumn] === line2[startColumn])
++startColumn;
lines[0] = line2.substring(startColumn);

var line1 = this._textModel.line(endLine - 1);
var line2 = lines[lines.length - 1];
for (var i = 0; i < endColumn && i < line2.length; ++i) {
if (startLine === endLine - 1 && endColumn - i <= startColumn)
break;
if (line1[endColumn - i - 1] !== line2[line2.length - i - 1])
break;
}
if (i) {
endColumn -= i;
lines[lines.length - 1] = line2.substring(0, line2.length - i);
}
}

var selection = this._getSelection();

if (lines.length === 0 && endLine < this._textModel.linesCount)
var oldRange = new WebInspector.TextRange(startLine, 0, endLine, 0);
else if (lines.length === 0 && startLine > 0)
var oldRange = new WebInspector.TextRange(startLine - 1, this._textModel.lineLength(startLine - 1), endLine - 1, this._textModel.lineLength(endLine - 1));
else
var oldRange = new WebInspector.TextRange(startLine, startColumn, endLine - 1, endColumn);

var newRange = this._setText(oldRange, lines.join("\n"));

this._paintScheduledLines(true);
this._restoreSelection(selection);

this._exitTextChangeMode(oldRange, newRange);
},

textChanged: function(oldRange, newRange)
{
this.beginDomUpdates();
this._removeDecorationsInRange(oldRange);
this._updateChunksForRanges(oldRange, newRange);
this._updateHighlightsForRange(newRange);
this.endDomUpdates();
},

_setText: function(range, text)
{
if (this._lastEditedRange && (!text || text.indexOf("\n") !== -1 || this._lastEditedRange.endLine !== range.startLine || this._lastEditedRange.endColumn !== range.startColumn))
this._textModel.markUndoableState();

var newRange = this._textModel.setText(range, text);
this._lastEditedRange = newRange;

return newRange;
},

_removeDecorationsInRange: function(range)
{
for (var i = this._chunkNumberForLine(range.startLine); i < this._textChunks.length; ++i) {
var chunk = this._textChunks[i];
if (chunk.startLine > range.endLine)
break;
chunk.removeAllDecorations();
}
},

_updateChunksForRanges: function(oldRange, newRange)
{

var firstChunkNumber = this._chunkNumberForLine(oldRange.startLine);
var lastChunkNumber = firstChunkNumber;
while (lastChunkNumber + 1 < this._textChunks.length) {
if (this._textChunks[lastChunkNumber + 1].startLine > oldRange.endLine)
break;
++lastChunkNumber;
}

var startLine = this._textChunks[firstChunkNumber].startLine;
var linesCount = this._textChunks[lastChunkNumber].startLine + this._textChunks[lastChunkNumber].linesCount - startLine;
var linesDiff = newRange.linesCount - oldRange.linesCount;
linesCount += linesDiff;

if (linesDiff) {

for (var chunkNumber = lastChunkNumber + 1; chunkNumber < this._textChunks.length; ++chunkNumber)
this._textChunks[chunkNumber].startLine += linesDiff;
}

var firstLineRow;
if (firstChunkNumber) {
var chunk = this._textChunks[firstChunkNumber - 1];
firstLineRow = chunk.expanded ? chunk.getExpandedLineRow(chunk.startLine + chunk.linesCount - 1) : chunk.element;
firstLineRow = firstLineRow.nextSibling;
} else
firstLineRow = this._container.firstChild;


for (var chunkNumber = firstChunkNumber; chunkNumber <= lastChunkNumber; ++chunkNumber) {
var chunk = this._textChunks[chunkNumber];
if (chunk.startLine + chunk.linesCount > this._textModel.linesCount)
break;
var lineNumber = chunk.startLine;
for (var lineRow = firstLineRow; lineRow && lineNumber < chunk.startLine + chunk.linesCount; lineRow = lineRow.nextSibling) {
if (lineRow.lineNumber !== lineNumber || lineRow !== chunk.getExpandedLineRow(lineNumber) || lineRow.textContent !== this._textModel.line(lineNumber) || !lineRow.firstChild)
break;
++lineNumber;
}
if (lineNumber < chunk.startLine + chunk.linesCount)
break;
chunk.updateCollapsedLineRow();
++firstChunkNumber;
firstLineRow = lineRow;
startLine += chunk.linesCount;
linesCount -= chunk.linesCount;
}

if (firstChunkNumber > lastChunkNumber && linesCount === 0)
return;


var chunk = this._textChunks[lastChunkNumber + 1];
var linesInLastChunk = linesCount % this._defaultChunkSize;
if (chunk && !chunk.decorated && linesInLastChunk > 0 && linesInLastChunk + chunk.linesCount <= this._defaultChunkSize) {
++lastChunkNumber;
linesCount += chunk.linesCount;
}

var scrollTop = this.element.scrollTop;
var scrollLeft = this.element.scrollLeft;


var firstUnmodifiedLineRow = null;
var chunk = this._textChunks[lastChunkNumber + 1];
if (chunk) {
firstUnmodifiedLineRow = chunk.expanded ? chunk.getExpandedLineRow(chunk.startLine) : chunk.element;
}
while (firstLineRow && firstLineRow !== firstUnmodifiedLineRow) {
var lineRow = firstLineRow;
firstLineRow = firstLineRow.nextSibling;
this._container.removeChild(lineRow);
}


for (var chunkNumber = firstChunkNumber; linesCount > 0; ++chunkNumber) {
var chunkLinesCount = Math.min(this._defaultChunkSize, linesCount);
var newChunk = this._createNewChunk(startLine, startLine + chunkLinesCount);
this._container.insertBefore(newChunk.element, firstUnmodifiedLineRow);

if (chunkNumber <= lastChunkNumber)
this._textChunks[chunkNumber] = newChunk;
else
this._textChunks.splice(chunkNumber, 0, newChunk);
startLine += chunkLinesCount;
linesCount -= chunkLinesCount;
}
if (chunkNumber <= lastChunkNumber)
this._textChunks.splice(chunkNumber, lastChunkNumber - chunkNumber + 1);

this.element.scrollTop = scrollTop;
this.element.scrollLeft = scrollLeft;
},

_updateHighlightsForRange: function(range)
{
var visibleFrom = this.element.scrollTop;
var visibleTo = this.element.scrollTop + this.element.clientHeight;

var result = this._findVisibleChunks(visibleFrom, visibleTo);
var chunk = this._textChunks[result.end - 1];
var lastVisibleLine = chunk.startLine + chunk.linesCount;

lastVisibleLine = Math.max(lastVisibleLine, range.endLine + 1);
lastVisibleLine = Math.min(lastVisibleLine, this._textModel.linesCount);

var updated = this._highlighter.updateHighlight(range.startLine, lastVisibleLine);
if (!updated) {

for (var i = this._chunkNumberForLine(range.startLine); i < this._textChunks.length; ++i)
this._textChunks[i].expanded = false;
}

this._repaintAll();
},

_collectLinesFromDiv: function(lines, element)
{
var textContents = [];
var node = element.nodeType === Node.TEXT_NODE ? element : element.traverseNextNode(element);
while (node) {
if (element.decorationsElement === node) {
node = node.nextSibling;
continue;
}
if (node.nodeName.toLowerCase() === "br")
textContents.push("\n");
else if (node.nodeType === Node.TEXT_NODE)
textContents.push(node.textContent);
node = node.traverseNextNode(element);
}

var textContent = textContents.join("");

textContent = textContent.replace(/\n$/, "");

textContents = textContent.split("\n");
for (var i = 0; i < textContents.length; ++i)
lines.push(textContents[i]);
}
}