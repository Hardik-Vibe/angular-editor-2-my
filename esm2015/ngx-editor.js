import { Injectable, Component, Input, Output, ViewChild, EventEmitter, Renderer2, forwardRef, HostListener, NgModule } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse } from '@angular/common/http';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/map';
import { NG_VALUE_ACCESSOR, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PopoverConfig, PopoverModule } from 'ngx-bootstrap';
import { CommonModule } from '@angular/common';

function canEnableToolbarOptions(value, toolbar) {
    if (value) {
        if (toolbar['length'] === 0) {
            return true;
        }
        else {
            const                  found = toolbar.filter(array => {
                return array.indexOf(value) !== -1;
            });
            return found.length ? true : false;
        }
    }
    else {
        return false;
    }
}
function getEditorConfiguration(value, ngxEditorConfig, input) {
    for (const                  i in ngxEditorConfig) {
        if (i) {
            if (input[i] !== undefined) {
                value[i] = input[i];
            }
            if (!value.hasOwnProperty(i)) {
                value[i] = ngxEditorConfig[i];
            }
        }
    }
    return value;
}
function canResize(resizer) {
    if (resizer === 'basic') {
        return 'vertical';
    }
    return false;
}
function saveSelection() {
    if (window.getSelection) {
        const                  sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            return sel.getRangeAt(0);
        }
    }
    else if (document.getSelection && document.createRange) {
        return document.createRange();
    }
    return null;
}
function restoreSelection(range) {
    if (range) {
        if (window.getSelection) {
            const                  sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            return true;
        }
        else if (document.getSelection && range.select) {
            range.select();
            return true;
        }
    }
    else {
        return false;
    }
}


var Utils = Object.freeze({
	canEnableToolbarOptions: canEnableToolbarOptions,
	getEditorConfiguration: getEditorConfiguration,
	canResize: canResize,
	saveSelection: saveSelection,
	restoreSelection: restoreSelection
});

class CommandExecutorService {
    constructor(_http) {
        this._http = _http;
        this.savedSelection = undefined;
    }
    execute(command) {
        if (!this.savedSelection && command !== 'enableObjectResizing') {
            throw new Error('Range out of Editor');
        }
        if (command === 'enableObjectResizing') {
            document.execCommand('enableObjectResizing', true, true);
            return;
        }
        if (command === 'blockquote') {
            document.execCommand('formatBlock', false, 'blockquote');
            return;
        }
        if (command === 'removeBlockquote') {
            // document.execCommand('formatBlock', false, 'div');
            document.execCommand('outdent', false, undefined);
            return;
        }
        document.execCommand(command, false, null);
        return;
    }
    insertImage(imageURI) {
        if (this.savedSelection) {
            if (imageURI) {
                const                  restored = restoreSelection(this.savedSelection);
                if (restored) {
                    const                  inserted = document.execCommand('insertImage', false, imageURI);
                    if (!inserted) {
                        throw new Error('Invalid URL');
                    }
                }
            }
        }
        else {
            throw new Error('Range out of the editor');
        }
        return;
    }
    insertVideo(videParams) {
        if (this.savedSelection) {
            if (videParams) {
                const                  restored = restoreSelection(this.savedSelection);
                if (restored) {
                    if (this.isYoutubeLink(videParams.videoUrl)) {
                        const                  youtubeURL = '<iframe width="' + videParams.width + '" height="' + videParams.height + '"'
                            + 'src="' + videParams.videoUrl + '"></iframe>';
                        this.insertHtml(youtubeURL);
                    }
                    else if (this.checkTagSupportInBrowser('video')) {
                        if (this.isValidURL(videParams.videoUrl)) {
                            const                  videoSrc = '<video width="' + videParams.width + '" height="' + videParams.height + '"'
                                + ' controls="true"><source src="' + videParams.videoUrl + '"></video>';
                            this.insertHtml(videoSrc);
                        }
                        else {
                            throw new Error('Invalid video URL');
                        }
                    }
                    else {
                        throw new Error('Unable to insert video');
                    }
                }
            }
        }
        else {
            throw new Error('Range out of the editor');
        }
        return;
    }
    isYoutubeLink(url) {
        const                  ytRegExp = /^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/.+/;
        return ytRegExp.test(url);
    }
    isValidURL(url) {
        const                  urlRegExp = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
        return urlRegExp.test(url);
    }
    uploadImage(file, endPoint) {
        if (!endPoint) {
            throw new Error('Image Endpoint isn`t provided or invalid');
        }
        const                  formData = new FormData();
        if (file) {
            formData.append('file', file);
            const                  req = new HttpRequest('POST', endPoint, formData, {
                reportProgress: true
            });
            return this._http.request(req);
        }
        else {
            throw new Error('Invalid Image');
        }
    }
    createLink(params) {
        if (this.savedSelection) {
            if (params.urlNewTab) {
                const                  newUrl = '<a href="' + params.urlLink + '" target="_blank">' + params.urlText + '</a>';
                if (document.getSelection().type !== 'Range') {
                    const                  restored = restoreSelection(this.savedSelection);
                    if (restored) {
                        this.insertHtml(newUrl);
                    }
                }
                else {
                    throw new Error('Only new links can be inserted. You cannot edit URL`s');
                }
            }
            else {
                const                  restored = restoreSelection(this.savedSelection);
                if (restored) {
                    document.execCommand('createLink', false, params.urlLink);
                }
            }
        }
        else {
            throw new Error('Range out of the editor');
        }
        return;
    }
    insertColor(color, where) {
        if (this.savedSelection) {
            const                  restored = restoreSelection(this.savedSelection);
            if (restored && this.checkSelection()) {
                if (where === 'textColor') {
                    document.execCommand('foreColor', false, color);
                }
                else {
                    document.execCommand('hiliteColor', false, color);
                }
            }
        }
        else {
            throw new Error('Range out of the editor');
        }
        return;
    }
    setFontSize(fontSize) {
        if (this.savedSelection && this.checkSelection()) {
            const                  deletedValue = this.deleteAndGetElement();
            if (deletedValue) {
                const                  restored = restoreSelection(this.savedSelection);
                if (restored) {
                    if (this.isNumeric(fontSize)) {
                        const                  fontPx = '<span style="font-size: ' + fontSize + 'px;">' + deletedValue + '</span>';
                        this.insertHtml(fontPx);
                    }
                    else {
                        const                  fontPx = '<span style="font-size: ' + fontSize + ';">' + deletedValue + '</span>';
                        this.insertHtml(fontPx);
                    }
                }
            }
        }
        else {
            throw new Error('Range out of the editor');
        }
    }
    setFontName(fontName) {
        if (this.savedSelection && this.checkSelection()) {
            const                  deletedValue = this.deleteAndGetElement();
            if (deletedValue) {
                const                  restored = restoreSelection(this.savedSelection);
                if (restored) {
                    if (this.isNumeric(fontName)) {
                        const                  fontFamily = '<span style="font-family: ' + fontName + 'px;">' + deletedValue + '</span>';
                        this.insertHtml(fontFamily);
                    }
                    else {
                        const                  fontFamily = '<span style="font-family: ' + fontName + ';">' + deletedValue + '</span>';
                        this.insertHtml(fontFamily);
                    }
                }
            }
        }
        else {
            throw new Error('Range out of the editor');
        }
    }
    insertHtml(html) {
        const                  isHTMLInserted = document.execCommand('insertHTML', false, html);
        if (!isHTMLInserted) {
            throw new Error('Unable to perform the operation');
        }
        return;
    }
    isNumeric(value) {
        return /^-{0,1}\d+$/.test(value);
    }
    deleteAndGetElement() {
        let                  slectedText;
        if (this.savedSelection) {
            slectedText = this.savedSelection.toString();
            this.savedSelection.deleteContents();
            return slectedText;
        }
        return false;
    }
    checkSelection() {
        const                  slectedText = this.savedSelection.toString();
        if (slectedText.length === 0) {
            throw new Error('No Selection Made');
        }
        return true;
    }
    checkTagSupportInBrowser(tag) {
        return !(document.createElement(tag) instanceof HTMLUnknownElement);
    }
}
CommandExecutorService.decorators = [
    { type: Injectable },
];
CommandExecutorService.ctorParameters = () => [
    { type: HttpClient, },
];

const DURATION = 7000;
class MessageService {
    constructor() {
        this.message = new Subject();
    }
    getMessage() {
        return this.message.asObservable();
    }
    sendMessage(message) {
        this.message.next(message);
        this.clearMessageIn(DURATION);
        return;
    }
    clearMessageIn(milliseconds) {
        setTimeout(() => {
            this.message.next(undefined);
        }, milliseconds);
        return;
    }
}
MessageService.decorators = [
    { type: Injectable },
];
MessageService.ctorParameters = () => [];

const ngxEditorConfig = {
    editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '0',
    width: 'auto',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: true,
    showToolbar: true,
    placeholder: 'Enter text here...',
    imageEndPoint: '',
    toolbar: [
        ['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript'],
        ['fontName', 'fontSize', 'color'],
        ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'indent', 'outdent'],
        ['cut', 'copy', 'delete', 'removeFormat', 'undo', 'redo'],
        ['paragraph', 'blockquote', 'removeBlockquote', 'horizontalLine', 'orderedList', 'unorderedList'],
        ['link', 'unlink', 'image', 'video']
    ]
};

class NgxEditorComponent {
    constructor(_messageService, _commandExecutor, _renderer) {
        this._messageService = _messageService;
        this._commandExecutor = _commandExecutor;
        this._renderer = _renderer;
        this.resizer = 'stack';
        this.config = ngxEditorConfig;
        this.blur = new EventEmitter();
        this.focus = new EventEmitter();
        this.Utils = Utils;
    }
    onTextAreaFocus() {
        this.focus.emit('focus');
        return;
    }
    onEditorFocus() {
        this.textArea.nativeElement.focus();
    }
    onContentChange(html) {
        if (typeof this.onChange === 'function') {
            this.onChange(html);
            this.togglePlaceholder(html);
        }
        return;
    }
    onTextAreaBlur() {
        this._commandExecutor.savedSelection = saveSelection();
        if (typeof this.onTouched === 'function') {
            this.onTouched();
        }
        this.blur.emit('blur');
        return;
    }
    resizeTextArea(offsetY) {
        let                  newHeight = parseInt(this.height, 10);
        newHeight += offsetY;
        this.height = newHeight + 'px';
        this.textArea.nativeElement.style.height = this.height;
        return;
    }
    executeCommand(commandName) {
        try {
            this._commandExecutor.execute(commandName);
        }
        catch (                 error) {
            this._messageService.sendMessage(error.message);
        }
        return;
    }
    writeValue(value) {
        this.togglePlaceholder(value);
        if (value === null || value === undefined || value === '' || value === '<br>') {
            value = null;
        }
        this.refreshView(value);
    }
    registerOnChange(fn) {
        this.onChange = fn;
    }
    registerOnTouched(fn) {
        this.onTouched = fn;
    }
    refreshView(value) {
        const                  normalizedValue = value === null ? '' : value;
        this._renderer.setProperty(this.textArea.nativeElement, 'innerHTML', normalizedValue);
        return;
    }
    togglePlaceholder(value) {
        if (!value || value === '<br>' || value === '') {
            this._renderer.addClass(this.ngxWrapper.nativeElement, 'show-placeholder');
        }
        else {
            this._renderer.removeClass(this.ngxWrapper.nativeElement, 'show-placeholder');
        }
        return;
    }
    getCollectiveParams() {
        return {
            editable: this.editable,
            spellcheck: this.spellcheck,
            placeholder: this.placeholder,
            translate: this.translate,
            height: this.height,
            minHeight: this.minHeight,
            width: this.width,
            minWidth: this.minWidth,
            enableToolbar: this.enableToolbar,
            showToolbar: this.showToolbar,
            imageEndPoint: this.imageEndPoint,
            toolbar: this.toolbar
        };
    }
    ngOnInit() {
        this.config = this.Utils.getEditorConfiguration(this.config, ngxEditorConfig, this.getCollectiveParams());
        this.height = this.height || this.textArea.nativeElement.offsetHeight;
        this.executeCommand('enableObjectResizing');
    }
}
NgxEditorComponent.decorators = [
    { type: Component, args: [{
                selector: 'app-ngx-editor',
                template: `<div class="ngx-editor" id="ngxEditor" [style.width]="config['width']" [style.minWidth]="config['minWidth']" tabindex="0"
  (focus)="onEditorFocus()">
  <app-ngx-editor-toolbar [config]="config" (execute)="executeCommand($event)"></app-ngx-editor-toolbar>
  <!-- text area -->
  <div class="ngx-wrapper" #ngxWrapper>
    <div class="ngx-editor-textarea" [attr.contenteditable]="config['editable']" (input)="onContentChange($event.target.innerHTML)"
      [attr.translate]="config['translate']" [attr.spellcheck]="config['spellcheck']" [style.height]="config['height']" [style.minHeight]="config['minHeight']"
      [style.resize]="Utils?.canResize(resizer)" (focus)="onTextAreaFocus()" (blur)="onTextAreaBlur()" #ngxTextArea></div>
    <span class="ngx-editor-placeholder">{{ placeholder || config['placeholder'] }}</span>
  </div>
  <app-ngx-editor-message></app-ngx-editor-message>
  <app-ngx-grippie *ngIf="resizer === 'stack'"></app-ngx-grippie>
</div>
`,
                styles: [`.ngx-editor{position:relative}.ngx-editor ::ng-deep [contenteditable=true]:empty:before{display:block;color:#868e96;opacity:1}.ngx-editor .ngx-wrapper{position:relative}.ngx-editor .ngx-wrapper .ngx-editor-textarea{min-height:5rem;padding:.5rem .8rem 1rem;border:1px solid #ddd;background-color:transparent;overflow-x:hidden;overflow-y:auto;z-index:2;position:relative}.ngx-editor .ngx-wrapper .ngx-editor-textarea.focus,.ngx-editor .ngx-wrapper .ngx-editor-textarea:focus{outline:0}.ngx-editor .ngx-wrapper .ngx-editor-textarea ::ng-deep blockquote{margin-left:1rem;border-left:.2em solid #dfe2e5;padding-left:.5rem}.ngx-editor .ngx-wrapper ::ng-deep p{margin-bottom:0}.ngx-editor .ngx-wrapper .ngx-editor-placeholder{display:none;position:absolute;top:0;padding:.5rem .8rem 1rem .9rem;z-index:1;color:#6c757d;opacity:1}.ngx-editor .ngx-wrapper.show-placeholder .ngx-editor-placeholder{display:block}`],
                providers: [
                    {
                        provide: NG_VALUE_ACCESSOR,
                        useExisting: forwardRef(() => NgxEditorComponent),
                        multi: true
                    }
                ]
            },] },
];
NgxEditorComponent.ctorParameters = () => [
    { type: MessageService, },
    { type: CommandExecutorService, },
    { type: Renderer2, },
];
NgxEditorComponent.propDecorators = {
    "editable": [{ type: Input },],
    "spellcheck": [{ type: Input },],
    "placeholder": [{ type: Input },],
    "translate": [{ type: Input },],
    "height": [{ type: Input },],
    "minHeight": [{ type: Input },],
    "width": [{ type: Input },],
    "minWidth": [{ type: Input },],
    "toolbar": [{ type: Input },],
    "resizer": [{ type: Input },],
    "config": [{ type: Input },],
    "showToolbar": [{ type: Input },],
    "enableToolbar": [{ type: Input },],
    "imageEndPoint": [{ type: Input },],
    "blur": [{ type: Output },],
    "focus": [{ type: Output },],
    "textArea": [{ type: ViewChild, args: ['ngxTextArea',] },],
    "ngxWrapper": [{ type: ViewChild, args: ['ngxWrapper',] },],
};

class NgxGrippieComponent {
    constructor(_editorComponent) {
        this._editorComponent = _editorComponent;
        this.oldY = 0;
        this.grabber = false;
    }
    onMouseMove(event) {
        if (!this.grabber) {
            return;
        }
        this._editorComponent.resizeTextArea(event.clientY - this.oldY);
        this.oldY = event.clientY;
    }
    onMouseUp(event) {
        this.grabber = false;
    }
    onResize(event, resizer) {
        this.grabber = true;
        this.oldY = event.clientY;
        event.preventDefault();
    }
}
NgxGrippieComponent.decorators = [
    { type: Component, args: [{
                selector: 'app-ngx-grippie',
                template: `<div class="ngx-editor-grippie">
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="isolation:isolate" viewBox="651.6 235 26 5"
    width="26" height="5">
    <g id="sprites">
      <path d=" M 651.6 235 L 653.6 235 L 653.6 237 L 651.6 237 M 654.6 238 L 656.6 238 L 656.6 240 L 654.6 240 M 660.6 238 L 662.6 238 L 662.6 240 L 660.6 240 M 666.6 238 L 668.6 238 L 668.6 240 L 666.6 240 M 672.6 238 L 674.6 238 L 674.6 240 L 672.6 240 M 657.6 235 L 659.6 235 L 659.6 237 L 657.6 237 M 663.6 235 L 665.6 235 L 665.6 237 L 663.6 237 M 669.6 235 L 671.6 235 L 671.6 237 L 669.6 237 M 675.6 235 L 677.6 235 L 677.6 237 L 675.6 237"
        fill="rgb(147,153,159)" />
    </g>
  </svg>
</div>
`,
                styles: [`.ngx-editor-grippie{height:9px;background-color:#f1f1f1;position:relative;text-align:center;cursor:s-resize;border:1px solid #ddd;border-top:transparent}.ngx-editor-grippie svg{position:absolute;top:1.5px;width:50%;right:25%}`]
            },] },
];
NgxGrippieComponent.ctorParameters = () => [
    { type: NgxEditorComponent, },
];
NgxGrippieComponent.propDecorators = {
    "onMouseMove": [{ type: HostListener, args: ['document:mousemove', ['$event'],] },],
    "onMouseUp": [{ type: HostListener, args: ['document:mouseup', ['$event'],] },],
    "onResize": [{ type: HostListener, args: ['mousedown', ['$event'],] },],
};

class NgxEditorMessageComponent {
    constructor(_messageService) {
        this._messageService = _messageService;
        this.ngxMessage = undefined;
        this._messageService.getMessage().subscribe((message) => this.ngxMessage = message);
    }
    clearMessage() {
        this.ngxMessage = undefined;
        return;
    }
}
NgxEditorMessageComponent.decorators = [
    { type: Component, args: [{
                selector: 'app-ngx-editor-message',
                template: `<div class="ngx-editor-message" *ngIf="ngxMessage" (dblclick)="clearMessage()">
  {{ ngxMessage }}
</div>
`,
                styles: [`.ngx-editor-message{font-size:80%;background-color:#f1f1f1;border:1px solid #ddd;border-top:transparent;padding:0 .5rem .1rem;-webkit-transition:.5s ease-in;transition:.5s ease-in}`]
            },] },
];
NgxEditorMessageComponent.ctorParameters = () => [
    { type: MessageService, },
];

class NgxEditorToolbarComponent {
    constructor(_popOverConfig, _formBuilder, _messageService, _commandExecutorService) {
        this._popOverConfig = _popOverConfig;
        this._formBuilder = _formBuilder;
        this._messageService = _messageService;
        this._commandExecutorService = _commandExecutorService;
        this.uploadComplete = true;
        this.updloadPercentage = 0;
        this.isUploading = false;
        this.selectedColorTab = 'textColor';
        this.fontName = '';
        this.fontSize = '';
        this.hexColor = '';
        this.isImageUploader = false;
        this.execute = new EventEmitter();
        this._popOverConfig.outsideClick = true;
        this._popOverConfig.placement = 'bottom';
        this._popOverConfig.container = 'body';
    }
    canEnableToolbarOptions(value) {
        return canEnableToolbarOptions(value, this.config['toolbar']);
    }
    triggerCommand(command) {
        console.log(command);
        this.execute.emit(command);
    }
    buildUrlForm() {
        this.urlForm = this._formBuilder.group({
            urlLink: ['', [Validators.required]],
            urlText: ['', [Validators.required]],
            urlNewTab: [true]
        });
        return;
    }
    insertLink() {
        try {
            this._commandExecutorService.createLink(this.urlForm.value);
        }
        catch (                 error) {
            this._messageService.sendMessage(error.message);
        }
        this.buildUrlForm();
        this.urlPopover.hide();
        return;
    }
    buildImageForm() {
        this.imageForm = this._formBuilder.group({
            imageUrl: ['', [Validators.required]]
        });
        return;
    }
    buildVideoForm() {
        this.videoForm = this._formBuilder.group({
            videoUrl: ['', [Validators.required]],
            height: [''],
            width: ['']
        });
        return;
    }
    onFileChange(e) {
        this.uploadComplete = false;
        this.isUploading = true;
        if (e.target.files.length > 0) {
            const                  file = e.target.files[0];
            try {
                this._commandExecutorService.uploadImage(file, this.config.imageEndPoint).subscribe(event => {
                    if (event.type) {
                        this.updloadPercentage = Math.round(100 * event.loaded / event.total);
                    }
                    if (event instanceof HttpResponse) {
                        try {
                            this._commandExecutorService.insertImage(event.body.url);
                        }
                        catch (                 error) {
                            this._messageService.sendMessage(error.message);
                        }
                        this.uploadComplete = true;
                        this.isUploading = false;
                    }
                });
            }
            catch (                 error) {
                this._messageService.sendMessage(error.message);
                this.uploadComplete = true;
                this.isUploading = false;
            }
        }
        return;
    }
    insertImage() {
        try {
            this._commandExecutorService.insertImage(this.imageForm.value.imageUrl);
        }
        catch (                 error) {
            this._messageService.sendMessage(error.message);
        }
        this.buildImageForm();
        this.imagePopover.hide();
        return;
    }
    insertVideo() {
        try {
            this._commandExecutorService.insertVideo(this.videoForm.value);
        }
        catch (                 error) {
            this._messageService.sendMessage(error.message);
        }
        this.buildVideoForm();
        this.videoPopover.hide();
        return;
    }
    insertColor(color, where) {
        try {
            this._commandExecutorService.insertColor(color, where);
        }
        catch (                 error) {
            this._messageService.sendMessage(error.message);
        }
        this.colorPopover.hide();
        return;
    }
    setFontSize(fontSize) {
        try {
            this._commandExecutorService.setFontSize(fontSize);
        }
        catch (                 error) {
            this._messageService.sendMessage(error.message);
        }
        this.fontSizePopover.hide();
        return;
    }
    setFontName(fontName) {
        try {
            this._commandExecutorService.setFontName(fontName);
        }
        catch (                 error) {
            this._messageService.sendMessage(error.message);
        }
        this.fontSizePopover.hide();
        return;
    }
    onlyNumbers(event) {
        return event.charCode >= 48 && event.charCode <= 57;
    }
    ngOnInit() {
        this.buildUrlForm();
        this.buildImageForm();
        this.buildVideoForm();
    }
}
NgxEditorToolbarComponent.decorators = [
    { type: Component, args: [{
                selector: 'app-ngx-editor-toolbar',
                template: `<div class="ngx-toolbar" *ngIf="config['showToolbar']">
  <div class="ngx-toolbar-set">
  </div>
  <div class="ngx-toolbar-set">
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('fontName')" (click)="fontName = ''" title="Font Family"
      [popover]="fontNameTemplate" #fontNamePopover="bs-popover" containerClass="ngxePopover" [disabled]="!config['enableToolbar']">
      <i class="fa fa-font" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('fontSize')" (click)="fontSize = ''" title="Font Size"
      [popover]="fontSizeTemplate" #fontSizePopover="bs-popover" containerClass="ngxePopover" [disabled]="!config['enableToolbar']">
      <i class="fa fa-text-height" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('color')" (click)="hexColor = ''" title="Color Picker"
      [popover]="insertColorTemplate" #colorPopover="bs-popover" containerClass="ngxePopover" [disabled]="!config['enableToolbar']">
      <i class="fa fa-tint" aria-hidden="true"></i>
    </button>
  </div>
  <div class="ngx-toolbar-set">
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('justifyLeft')" (click)="triggerCommand('justifyLeft')"
      title="Justify Left" [disabled]="!config['enableToolbar']">
      <i class="fa fa-align-left" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('justifyCenter')" (click)="triggerCommand('justifyCenter')"
      title="Justify Center" [disabled]="!config['enableToolbar']">
      <i class="fa fa-align-center" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('justifyRight')" (click)="triggerCommand('justifyRight')"
      title="Justify Right" [disabled]="!config['enableToolbar']">
      <i class="fa fa-align-right" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('justifyFull')" (click)="triggerCommand('justifyFull')"
      title="Justify" [disabled]="!config['enableToolbar']">
      <i class="fa fa-align-justify" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('indent')" (click)="triggerCommand('indent')"
      title="Indent" [disabled]="!config['enableToolbar']">
      <i class="fa fa-indent" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('outdent')" (click)="triggerCommand('outdent')"
      title="Outdent" [disabled]="!config['enableToolbar']">
      <i class="fa fa-outdent" aria-hidden="true"></i>
    </button>
  </div>
  <div class="ngx-toolbar-set">
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('cut')" (click)="triggerCommand('cut')" title="Cut"
      [disabled]="!config['enableToolbar']">
      <i class="fa fa-scissors" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('copy')" (click)="triggerCommand('copy')"
      title="Copy" [disabled]="!config['enableToolbar']">
      <i class="fa fa-files-o" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('delete')" (click)="triggerCommand('delete')"
      title="Delete" [disabled]="!config['enableToolbar']">
      <i class="fa fa-trash" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('removeFormat')" (click)="triggerCommand('removeFormat')"
      title="Clear Formatting" [disabled]="!config['enableToolbar']">
      <i class="fa fa-eraser" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('undo')" (click)="triggerCommand('undo')"
      title="Undo" [disabled]="!config['enableToolbar']">
      <i class="fa fa-undo" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('redo')" (click)="triggerCommand('redo')"
      title="Redo" [disabled]="!config['enableToolbar']">
      <i class="fa fa-repeat" aria-hidden="true"></i>
    </button>
  </div>
  <div class="ngx-toolbar-set">
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('paragraph')" (click)="triggerCommand('insertParagraph')"
      title="Paragraph" [disabled]="!config['enableToolbar']">
      <i class="fa fa-paragraph" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('blockquote')" (click)="triggerCommand('blockquote')"
      title="Blockquote" [disabled]="!config['enableToolbar']">
      <i class="fa fa-quote-left" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('removeBlockquote')" (click)="triggerCommand('removeBlockquote')"
      title="Remove Blockquote" [disabled]="!config['enableToolbar']">
      <i class="fa fa-quote-right" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('horizontalLine')" (click)="triggerCommand('insertHorizontalRule')"
      title="Horizontal Line" [disabled]="!config['enableToolbar']">
      <i class="fa fa-minus" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('unorderedList')" (click)="triggerCommand('insertUnorderedList')"
      title="Unordered List" [disabled]="!config['enableToolbar']">
      <i class="fa fa-list-ul" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('orderedList')" (click)="triggerCommand('insertOrderedList')"
      title="Ordered List" [disabled]="!config['enableToolbar']">
      <i class="fa fa-list-ol" aria-hidden="true"></i>
    </button>
  </div>
  <div class="ngx-toolbar-set">
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('link')" (click)="buildUrlForm()" [popover]="insertLinkTemplate"
      title="Insert Link" #urlPopover="bs-popover" containerClass="ngxePopover" [disabled]="!config['enableToolbar']">
      <i class="fa fa-link" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('unlink')" (click)="triggerCommand('unlink')"
      title="Unlink" [disabled]="!config['enableToolbar']">
      <i class="fa fa-chain-broken" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('image')" (click)="buildImageForm()" title="Insert Image"
      [popover]="insertImageTemplate" #imagePopover="bs-popover" containerClass="ngxePopover" [disabled]="!config['enableToolbar']">
      <i class="fa fa-picture-o" aria-hidden="true"></i>
    </button>
    <button type="button" class="ngx-editor-button" *ngIf="canEnableToolbarOptions('video')" (click)="buildVideoForm()" title="Insert Video"
      [popover]="insertVideoTemplate" #videoPopover="bs-popover" containerClass="ngxePopover" [disabled]="!config['enableToolbar']">
      <i class="fa fa-youtube-play" aria-hidden="true"></i>
    </button>
  </div>
</div>
<!-- URL Popover template -->
<ng-template #insertLinkTemplate>
  <div class="ngxe-popover extra-gt">
    <form [formGroup]="urlForm" (ngSubmit)="urlForm.valid && insertLink()" autocomplete="off">
      <div class="form-group">
        <label for="urlInput" class="small">URL</label>
        <input type="text" class="form-control-sm" id="URLInput" placeholder="URL" formControlName="urlLink" required>
      </div>
      <div class="form-group">
        <label for="urlTextInput" class="small">Text</label>
        <input type="text" class="form-control-sm" id="urlTextInput" placeholder="Text" formControlName="urlText" required>
      </div>
      <div class="form-check">
        <input type="checkbox" class="form-check-input" id="urlNewTab" formControlName="urlNewTab">
        <label class="form-check-label" for="urlNewTab">Open in new tab</label>
      </div>
      <button type="submit" class="btn-primary btn-sm btn">Submit</button>
    </form>
  </div>
</ng-template>
<!-- Image Uploader Popover template -->
<ng-template #insertImageTemplate>
  <div class="ngxe-popover imgc-ctnr">
    <div class="imgc-topbar btn-ctnr">
      <button type="button" class="btn" [ngClass]="{active: isImageUploader}" (click)="isImageUploader = true">
        <i class="fa fa-upload"></i>
      </button>
      <button type="button" class="btn" [ngClass]="{active: !isImageUploader}" (click)="isImageUploader = false">
        <i class="fa fa-link"></i>
      </button>
    </div>
    <div class="imgc-ctnt is-image">
      <div *ngIf="isImageUploader; else insertImageLink"> </div>
      <div *ngIf="!isImageUploader; else imageUploder"> </div>
      <ng-template #imageUploder>
        <div class="ngx-insert-img-ph">
          <p *ngIf="uploadComplete">Choose Image</p>
          <p *ngIf="!uploadComplete">
            <span>Uploading Image</span>
            <br>
            <span>{{ updloadPercentage }} %</span>
          </p>
          <div class="ngxe-img-upl-frm">
            <input type="file" (change)="onFileChange($event)" accept="image/*" [disabled]="isUploading" [style.cursor]="isUploading ? 'not-allowed': 'allowed'">
          </div>
        </div>
      </ng-template>
      <ng-template #insertImageLink>
        <form class="extra-gt" [formGroup]="imageForm" (ngSubmit)="imageForm.valid && insertImage()" autocomplete="off">
          <div class="form-group">
            <label for="imageURLInput" class="small">URL</label>
            <input type="text" class="form-control-sm" id="imageURLInput" placeholder="URL" formControlName="imageUrl" required>
          </div>
          <button type="submit" class="btn-primary btn-sm btn">Submit</button>
        </form>
      </ng-template>
      <div class="progress" *ngIf="!uploadComplete">
        <div class="progress-bar progress-bar-striped progress-bar-animated bg-success" [ngClass]="{'bg-danger': updloadPercentage<20, 'bg-warning': updloadPercentage<50, 'bg-success': updloadPercentage>=100}"
          [style.width.%]="updloadPercentage"></div>
      </div>
    </div>
  </div>
</ng-template>
<!-- Insert Video Popover template -->
<ng-template #insertVideoTemplate>
  <div class="ngxe-popover imgc-ctnr">
    <div class="imgc-topbar btn-ctnr">
      <button type="button" class="btn active">
        <i class="fa fa-link"></i>
      </button>
    </div>
    <div class="imgc-ctnt is-image">
      <form class="extra-gt" [formGroup]="videoForm" (ngSubmit)="videoForm.valid && insertVideo()" autocomplete="off">
        <div class="form-group">
          <label for="videoURLInput" class="small">URL</label>
          <input type="text" class="form-control-sm" id="videoURLInput" placeholder="URL" formControlName="videoUrl" required>
        </div>
        <div class="row form-group">
          <div class="col">
            <input type="text" class="form-control-sm" formControlName="height" placeholder="height (px)" (keypress)="onlyNumbers($event)">
          </div>
          <div class="col">
            <input type="text" class="form-control-sm" formControlName="width" placeholder="width (px)" (keypress)="onlyNumbers($event)">
          </div>
          <label class="small">Height/Width</label>
        </div>
        <button type="submit" class="btn-primary btn-sm btn">Submit</button>
      </form>
    </div>
  </div>
</ng-template>
<!-- Insert color template -->
<ng-template #insertColorTemplate>
  <div class="ngxe-popover imgc-ctnr">
    <div class="imgc-topbar two-tabs">
      <span (click)="selectedColorTab ='textColor'" [ngClass]="{active: selectedColorTab ==='textColor'}">Text</span>
      <span (click)="selectedColorTab ='backgroundColor'" [ngClass]="{active: selectedColorTab ==='backgroundColor'}">Background</span>
    </div>
    <div class="imgc-ctnt is-color extra-gt1">
      <form autocomplete="off">
        <div class="form-group">
          <label for="hexInput" class="small">Hex Color</label>
          <input type="text" class="form-control-sm" id="hexInput" name="hexInput" maxlength="7" placeholder="HEX Color" [(ngModel)]="hexColor"
            required>
        </div>
        <button type="button" class="btn-primary btn-sm btn" (click)="insertColor(hexColor, selectedColorTab)">Submit</button>
      </form>
    </div>
  </div>
</ng-template>
<!-- font size template -->
<ng-template #fontSizeTemplate>
  <div class="ngxe-popover extra-gt1">
    <form autocomplete="off">
      <div class="form-group">
        <label for="fontSize" class="small">Font Size</label>
        <input type="text" class="form-control-sm" id="fontSize" name="fontSize" placeholder="Font size in px/rem" [(ngModel)]="fontSize"
          required>
      </div>
      <button type="button" class="btn-primary btn-sm btn" (click)="setFontSize(fontSize)">Submit</button>
    </form>
  </div>
</ng-template>
<!-- font family/name template -->
<ng-template #fontNameTemplate>
  <div class="ngxe-popover extra-gt1">
    <form autocomplete="off">
      <div class="form-group">
        <label for="fontSize" class="small">Font Size</label>
        <input type="text" class="form-control-sm" id="fontSize" name="fontName" placeholder="Ex: 'Times New Roman', Times, serif"
          [(ngModel)]="fontName" required>
      </div>
      <button type="button" class="btn-primary btn-sm btn" (click)="setFontName(fontName)">Submit</button>
    </form>
  </div>
</ng-template>
`,
                styles: [`::ng-deep .ngxePopover.popover{position:absolute;top:0;left:0;z-index:1060;display:block;max-width:276px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol";font-style:normal;font-weight:400;line-height:1.5;text-align:left;text-align:start;text-decoration:none;text-shadow:none;text-transform:none;letter-spacing:normal;word-break:normal;word-spacing:normal;white-space:normal;line-break:auto;font-size:.875rem;word-wrap:break-word;background-color:#fff;background-clip:padding-box;border:1px solid rgba(0,0,0,.2);border-radius:.3rem}::ng-deep .ngxePopover.popover .arrow{position:absolute;display:block;width:1rem;height:.5rem;margin:0 .3rem}::ng-deep .ngxePopover.popover .arrow::after,::ng-deep .ngxePopover.popover .arrow::before{position:absolute;display:block;content:"";border-color:transparent;border-style:solid}::ng-deep .ngxePopover.popover .popover-header{padding:.5rem .75rem;margin-bottom:0;font-size:1rem;color:inherit;background-color:#f7f7f7;border-bottom:1px solid #ebebeb;border-top-left-radius:calc(.3rem - 1px);border-top-right-radius:calc(.3rem - 1px)}::ng-deep .ngxePopover.popover .popover-header:empty{display:none}::ng-deep .ngxePopover.popover .popover-body{padding:.5rem .75rem;color:#212529}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=top],::ng-deep .ngxePopover.popover.bs-popover-top{margin-bottom:.5rem}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=top] .arrow,::ng-deep .ngxePopover.popover.bs-popover-top .arrow{bottom:calc((.5rem + 1px) * -1)}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=top] .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=top] .arrow::before,::ng-deep .ngxePopover.popover.bs-popover-top .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-top .arrow::before{border-width:.5rem .5rem 0}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=top] .arrow::before,::ng-deep .ngxePopover.popover.bs-popover-top .arrow::before{bottom:0;border-top-color:rgba(0,0,0,.25)}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=top] .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-top .arrow::after{bottom:1px;border-top-color:#fff}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=right],::ng-deep .ngxePopover.popover.bs-popover-right{margin-left:.5rem}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=right] .arrow,::ng-deep .ngxePopover.popover.bs-popover-right .arrow{left:calc((.5rem + 1px) * -1);width:.5rem;height:1rem;margin:.3rem 0}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=right] .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=right] .arrow::before,::ng-deep .ngxePopover.popover.bs-popover-right .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-right .arrow::before{border-width:.5rem .5rem .5rem 0}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=right] .arrow::before,::ng-deep .ngxePopover.popover.bs-popover-right .arrow::before{left:0;border-right-color:rgba(0,0,0,.25)}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=right] .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-right .arrow::after{left:1px;border-right-color:#fff}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=bottom],::ng-deep .ngxePopover.popover.bs-popover-bottom{margin-top:.5rem}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=bottom] .arrow,::ng-deep .ngxePopover.popover.bs-popover-bottom .arrow{left:45%!important;top:calc((.5rem + 1px) * -1)}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=bottom] .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=bottom] .arrow::before,::ng-deep .ngxePopover.popover.bs-popover-bottom .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-bottom .arrow::before{border-width:0 .5rem .5rem}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=bottom] .arrow::before,::ng-deep .ngxePopover.popover.bs-popover-bottom .arrow::before{top:0;border-bottom-color:rgba(0,0,0,.25)}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=bottom] .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-bottom .arrow::after{top:1px;border-bottom-color:#fff}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=bottom] .popover-header::before,::ng-deep .ngxePopover.popover.bs-popover-bottom .popover-header::before{position:absolute;top:0;left:50%;display:block;width:1rem;margin-left:-.5rem;content:"";border-bottom:1px solid #f7f7f7}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=left],::ng-deep .ngxePopover.popover.bs-popover-left{margin-right:.5rem}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=left] .arrow,::ng-deep .ngxePopover.popover.bs-popover-left .arrow{right:calc((.5rem + 1px) * -1);width:.5rem;height:1rem;margin:.3rem 0}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=left] .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=left] .arrow::before,::ng-deep .ngxePopover.popover.bs-popover-left .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-left .arrow::before{border-width:.5rem 0 .5rem .5rem}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=left] .arrow::before,::ng-deep .ngxePopover.popover.bs-popover-left .arrow::before{right:0;border-left-color:rgba(0,0,0,.25)}::ng-deep .ngxePopover.popover.bs-popover-auto[x-placement^=left] .arrow::after,::ng-deep .ngxePopover.popover.bs-popover-left .arrow::after{right:1px;border-left-color:#fff}::ng-deep .ngxePopover .btn{display:inline-block;font-weight:400;text-align:center;white-space:nowrap;vertical-align:middle;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;border:1px solid transparent;padding:.375rem .75rem;font-size:1rem;line-height:1.5;border-radius:.25rem;-webkit-transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,-webkit-box-shadow .15s ease-in-out;transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,-webkit-box-shadow .15s ease-in-out;transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out;transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out,-webkit-box-shadow .15s ease-in-out}::ng-deep .ngxePopover .btn.btn-sm{padding:.25rem .5rem;font-size:.875rem;line-height:1.5;border-radius:.2rem}::ng-deep .ngxePopover .btn:active,::ng-deep .ngxePopover .btn:focus{outline:0;-webkit-box-shadow:none;box-shadow:none}::ng-deep .ngxePopover .btn.btn-primary{color:#fff;background-color:#007bff;border-color:#007bff}::ng-deep .ngxePopover .btn.btn-primary:hover{color:#fff;background-color:#0069d9;border-color:#0062cc}::ng-deep .ngxePopover .btn:not(:disabled):not(.disabled){cursor:pointer}::ng-deep .ngxePopover form .form-group{margin-bottom:1rem}::ng-deep .ngxePopover form .form-group input{overflow:visible}::ng-deep .ngxePopover form .form-group .form-control-sm{width:100%;outline:0;border:none;border-bottom:1px solid #bdbdbd;border-radius:0;margin-bottom:1px;padding:.25rem .5rem;font-size:.875rem;line-height:1.5}::ng-deep .ngxePopover form .form-group.row{display:-webkit-box;display:-ms-flexbox;display:flex;-ms-flex-wrap:wrap;flex-wrap:wrap;margin-left:0;margin-right:0}::ng-deep .ngxePopover form .form-group.row .col{-ms-flex-preferred-size:0;flex-basis:0;-webkit-box-flex:1;-ms-flex-positive:1;flex-grow:1;max-width:100%;padding:0}::ng-deep .ngxePopover form .form-group.row .col:first-child{padding-right:15px}::ng-deep .ngxePopover form .form-check{position:relative;display:block;padding-left:1.25rem}::ng-deep .ngxePopover form .form-check .form-check-input{position:absolute;margin-top:.3rem;margin-left:-1.25rem}.ngx-toolbar{background-color:#f5f5f5;font-size:.8rem;padding:.2rem;border:1px solid #ddd}.ngx-toolbar .ngx-toolbar-set{display:inline-block;border-radius:5px;background-color:#fff}.ngx-toolbar .ngx-toolbar-set .ngx-editor-button{background-color:transparent;padding:.4rem;min-width:2.5rem;float:left;border:1px solid #ddd;border-right:transparent}.ngx-toolbar .ngx-toolbar-set .ngx-editor-button:hover{cursor:pointer;background-color:#f1f1f1;-webkit-transition:.2s ease;transition:.2s ease}.ngx-toolbar .ngx-toolbar-set .ngx-editor-button.focus,.ngx-toolbar .ngx-toolbar-set .ngx-editor-button:focus{outline:0}.ngx-toolbar .ngx-toolbar-set .ngx-editor-button:last-child{border-right:1px solid #ddd;border-top-right-radius:5px;border-bottom-right-radius:5px}.ngx-toolbar .ngx-toolbar-set .ngx-editor-button:first-child{border-top-left-radius:5px;border-bottom-left-radius:5px}.ngx-toolbar .ngx-toolbar-set .ngx-editor-button:disabled{background-color:#f5f5f5;pointer-events:none;cursor:not-allowed}::ng-deep .popover{border-top-right-radius:0;border-top-left-radius:0}::ng-deep .ngxe-popover{min-width:15rem;white-space:nowrap}::ng-deep .ngxe-popover .extra-gt,::ng-deep .ngxe-popover.extra-gt{padding-top:.5rem!important}::ng-deep .ngxe-popover .extra-gt1,::ng-deep .ngxe-popover.extra-gt1{padding-top:.75rem!important}::ng-deep .ngxe-popover .extra-gt2,::ng-deep .ngxe-popover.extra-gt2{padding-top:1rem!important}::ng-deep .ngxe-popover .form-group label{display:none;margin:0}::ng-deep .ngxe-popover .form-group .form-control-sm{width:100%;outline:0;border:none;border-bottom:1px solid #bdbdbd;border-radius:0;margin-bottom:1px;padding-left:0;padding-right:0}::ng-deep .ngxe-popover .form-group .form-control-sm:active,::ng-deep .ngxe-popover .form-group .form-control-sm:focus{border-bottom:2px solid #1e88e5;-webkit-box-shadow:none;box-shadow:none;margin-bottom:0}::ng-deep .ngxe-popover .form-group .form-control-sm.ng-dirty.ng-invalid:not(.ng-pristine){border-bottom:2px solid red}::ng-deep .ngxe-popover .form-check{margin-bottom:1rem}::ng-deep .ngxe-popover .btn:focus{-webkit-box-shadow:none!important;box-shadow:none!important}::ng-deep .ngxe-popover.imgc-ctnr{margin:-.5rem -.75rem}::ng-deep .ngxe-popover.imgc-ctnr .imgc-topbar{-webkit-box-shadow:0 1px 3px rgba(0,0,0,.12),0 1px 1px 1px rgba(0,0,0,.16);box-shadow:0 1px 3px rgba(0,0,0,.12),0 1px 1px 1px rgba(0,0,0,.16);border-bottom:0}::ng-deep .ngxe-popover.imgc-ctnr .imgc-topbar.btn-ctnr button{background-color:transparent;border-radius:0}::ng-deep .ngxe-popover.imgc-ctnr .imgc-topbar.btn-ctnr button:hover{cursor:pointer;background-color:#f1f1f1;-webkit-transition:.2s ease;transition:.2s ease}::ng-deep .ngxe-popover.imgc-ctnr .imgc-topbar.btn-ctnr button.active{color:#007bff;-webkit-transition:.2s ease;transition:.2s ease}::ng-deep .ngxe-popover.imgc-ctnr .imgc-topbar.two-tabs span{width:50%;text-align:center;display:inline-block;padding:.4rem 0;margin:0 -1px 2px}::ng-deep .ngxe-popover.imgc-ctnr .imgc-topbar.two-tabs span:hover{cursor:pointer}::ng-deep .ngxe-popover.imgc-ctnr .imgc-topbar.two-tabs span.active{margin-bottom:-2px;border-bottom:2px solid #007bff;color:#007bff}::ng-deep .ngxe-popover.imgc-ctnr .imgc-ctnt{padding:.5rem}::ng-deep .ngxe-popover.imgc-ctnr .imgc-ctnt.is-image .progress{height:.5rem;margin:.5rem -.5rem -.6rem}::ng-deep .ngxe-popover.imgc-ctnr .imgc-ctnt.is-image p{margin:0}::ng-deep .ngxe-popover.imgc-ctnr .imgc-ctnt.is-image .ngx-insert-img-ph{border:2px dashed #bdbdbd;padding:1.8rem 0;position:relative;letter-spacing:1px;text-align:center}::ng-deep .ngxe-popover.imgc-ctnr .imgc-ctnt.is-image .ngx-insert-img-ph:hover{background:#ebebeb}::ng-deep .ngxe-popover.imgc-ctnr .imgc-ctnt.is-image .ngx-insert-img-ph .ngxe-img-upl-frm{opacity:0;position:absolute;top:0;bottom:0;left:0;right:0;z-index:2147483640;overflow:hidden;margin:0;padding:0;width:100%}::ng-deep .ngxe-popover.imgc-ctnr .imgc-ctnt.is-image .ngx-insert-img-ph .ngxe-img-upl-frm input{cursor:pointer;position:absolute;right:0;top:0;bottom:0;margin:0}`],
                providers: [PopoverConfig]
            },] },
];
NgxEditorToolbarComponent.ctorParameters = () => [
    { type: PopoverConfig, },
    { type: FormBuilder, },
    { type: MessageService, },
    { type: CommandExecutorService, },
];
NgxEditorToolbarComponent.propDecorators = {
    "config": [{ type: Input },],
    "urlPopover": [{ type: ViewChild, args: ['urlPopover',] },],
    "imagePopover": [{ type: ViewChild, args: ['imagePopover',] },],
    "videoPopover": [{ type: ViewChild, args: ['videoPopover',] },],
    "fontSizePopover": [{ type: ViewChild, args: ['fontSizePopover',] },],
    "colorPopover": [{ type: ViewChild, args: ['colorPopover',] },],
    "execute": [{ type: Output },],
};

class NgxEditorModule {
}
NgxEditorModule.decorators = [
    { type: NgModule, args: [{
                imports: [CommonModule, FormsModule, ReactiveFormsModule, PopoverModule.forRoot()],
                declarations: [NgxEditorComponent, NgxGrippieComponent, NgxEditorMessageComponent, NgxEditorToolbarComponent],
                exports: [NgxEditorComponent, PopoverModule],
                providers: [CommandExecutorService, MessageService]
            },] },
];
NgxEditorModule.ctorParameters = () => [];

export { NgxEditorModule, CommandExecutorService as ɵc, MessageService as ɵb, NgxEditorMessageComponent as ɵe, NgxEditorToolbarComponent as ɵf, NgxEditorComponent as ɵa, NgxGrippieComponent as ɵd };
//# sourceMappingURL=ngx-editor.js.map
