/**
 * @fileoverview Class for the table layout in the body(data) area
 * @author NHN Ent. FE Development Team
 */
'use strict';

var View = require('../../base/view');
var util = require('../../common/util');
var dimensionConstMap = require('../../common/constMap').dimension;

var CELL_BORDER_WIDTH = dimensionConstMap.CELL_BORDER_WIDTH;

/**
 * Class for the table layout in the body(data) area
 * @module view/layout/bodyTable
 */
var BodyTable = View.extend(/**@lends module:view/layout/bodyTable.prototype */{
    /**
     * @constructs
     * @extends module:base/view
     * @param {Object} options - Options
     *      @param {String} [options.whichSide='R'] L or R (which side)
     */
    initialize: function(options) {
        View.prototype.initialize.call(this);

        this.setOwnProperties({
            dimensionModel: options.dimensionModel,
            renderModel: options.renderModel,
            columnModel: options.columnModel,
            viewFactory: options.viewFactory,
            painterManager: options.painterManager,
            whichSide: options.whichSide || 'R'
        });

        this.listenTo(this.dimensionModel, 'columnWidthChanged', this._onColumnWidthChanged);

        // To prevent issue of appearing vertical scrollbar when dummy rows exists
        if (this.whichSide === 'R') {
            this.listenTo(this.renderModel, 'change:dummyRowCount', this._resetOverflow);
            this.listenTo(this.dimensionModel, 'change:bodyHeight', this._resetHeight);
        }
        this._attachAllTableEventHandlers();
    },

    tagName: 'div',

    className: 'table_container',

    template: _.template('' +
        '<table width="100%" border="0" cellspacing="1" cellpadding="0" bgcolor="#EFEFEF">' +
        '   <colgroup><%=colGroup%></colgroup>' +
        '   <tbody><%=tbody%></tbody>' +
        '</table>'),

    /**
     * Event handler for 'columnWidthChanged' event on a dimension model.
     * @private
     */
    _onColumnWidthChanged: function() {
        var columnWidthList = this.dimensionModel.getColumnWidthList(this.whichSide),
            $colList = this.$el.find('col'),
            totalWidth = 0;

        _.each(columnWidthList, function(width, index) {
            $colList.eq(index).css('width', width - BodyTable.EXTRA_WIDTH);
            totalWidth += width + CELL_BORDER_WIDTH;
        }, this);

        if (this.whichSide === 'R' && util.isBrowserIE7()) {
            this.$el.width(totalWidth + CELL_BORDER_WIDTH); // addition for last cell
        }
    },

    /**
     * Resets the overflow of element based on the dummyRowCount in renderModel.
     * @private
     */
    _resetOverflow: function() {
        var overflow = 'visible';

        if (this.renderModel.get('dummyRowCount') > 0) {
            overflow = 'hidden';
        }
        this.$el.css('overflow', overflow);
    },

    /**
     * Resets the height of element based on the dummyRowCount in renderModel
     * @private
     */
    _resetHeight: function() {
        var dimensionModel = this.dimensionModel;

        if (this.renderModel.get('dummyRowCount') > 0) {
            this.$el.height(dimensionModel.get('bodyHeight') - dimensionModel.getScrollXHeight());
        } else {
            this.$el.css('height', '');
        }
    },

    /**
     * Reset position of a table container
     * @param {number} top  조정할 top 위치 값
     */
    resetTablePosition: function() {
        this.$el.css('top', this.renderModel.get('top'));
    },

    /**
     * Renders elements
     * @return {View.Layout.Body} This object
     */
    render: function() {
        this._destroyChildren();

        this.$el.html(this.template({
            colGroup: this._getColGroupMarkup(),
            tbody: ''
        }));

        this._addChildren(this.viewFactory.createRowList({
            bodyTableView: this,
            el: this.$el.find('tbody'),
            whichSide: this.whichSide
        }));
        this._renderChildren();

        // To prevent issue of appearing vertical scrollbar when dummy rows exists
        if (this.whichSide === 'R') {
            this._resetHeight();
            this._resetOverflow();
        }
        return this;
    },

    /**
     * 하위요소의 이벤트들을 this.el 에서 받아서 해당 요소에게 위임하도록 핸들러를 설정한다.
     * @param {string} selector - 선택자
     * @param {object} handlerInfos - 이벤트 정보 객체. ex) {'blur': {selector:string, handler:function}, 'click':{...}...}
     * @private
     */
    _attachTableEventHandler: function(selector, handlerInfos) {
        _.each(handlerInfos, function(obj, eventName) {
            this.$el.on(eventName, selector + ' ' + obj.selector, obj.handler);
        }, this);
    },

    /**
     * 테이블 내부(TR,TD)에서 발생하는 이벤트를 this.el로 넘겨 해당 요소들에게 위임하도록 설정한다.
     * @private
     */
    _attachAllTableEventHandlers: function() {
        var rowPainter = this.painterManager.getRowPainter(),
            cellPainters = this.painterManager.getCellPainters();

        this._attachTableEventHandler('tr', rowPainter.getEventHandlerInfo());

        _.each(cellPainters, function(painter, editType) {
            var selector = 'td[edit-type=' + editType + ']',
                handlerInfo = painter.getEventHandlerInfo();

            this._attachTableEventHandler(selector, handlerInfo);
        }, this);
    },

    /**
     * table 요소를 새로 생성한다.
     * (IE7-9에서 tbody의 innerHTML 변경할 수 없는 문제를 해결하여 성능개선을 하기 위해 사용)
     * @param {string} tbodyHtml - tbody의 innerHTML 문자열
     * @return {jquery} - 새로 생성된 table의 tbody 요소
     */
    redrawTable: function(tbodyHtml) {
        this.$el[0].innerHTML = this.template({
            colGroup: this._getColGroupMarkup(),
            tbody: tbodyHtml
        });

        return this.$el.find('tbody');
    },

    /**
     * Table 열 각각의 width 조정을 위한 columnGroup 마크업을 반환한다.
     * @return {string} <colgroup> 안에 들어갈 마크업 문자열
     * @private
     */
    _getColGroupMarkup: function() {
        var whichSide = this.whichSide,
            columnWidthList = this.dimensionModel.getColumnWidthList(whichSide),
            columnModelList = this.columnModel.getVisibleColumnModelList(whichSide, true),
            html = '';

        _.each(columnModelList, function(columnModel, index) {
            var name = columnModel['columnName'],
                width = columnWidthList[index] - BodyTable.EXTRA_WIDTH;

            html += '<col columnname="' + name + '" style="width:' + width + 'px">';
        });
        return html;
    }
}, {
    // IE7에서만 TD의 padding 만큼 넓이가 늘어나는 버그를 위한 예외처리를 위한 값
    EXTRA_WIDTH: util.isBrowserIE7() ? 20 : 0
});

module.exports = BodyTable;
