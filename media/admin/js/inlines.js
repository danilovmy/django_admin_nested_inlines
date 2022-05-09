/**
 * Django admin inlines
 *
 * @author Martin Achenrainer (martin AT wpsoft DOT at)
 * @requires jQuery 1.2.6 or later
 * Copyright (c) 2022, Martin Achenrainer
 * All rights reserved.
 */
'use strict';

const $ = django.jQuery;

const inlineRowClass = "inline-row"
const formsetClass = "js-inline-admin-formset"
const deleteButtonClass = "inline-deletelink"
const addButtonClass = "add-row"
const inlineLabelClass = "inline_label"
const errorRowClass = "row-form-errors"

const addInlineClickHandler = function (e) {
    e.preventDefault();
    const addRow = $(e.target).closest("." + addButtonClass);
    formset(addRow).addNewRow();
};

const deleteInlineClickHandler = function(e) {
    e.preventDefault();
    const formSet = formset(e.target)
    const row = $(e.target).closest("." + inlineRowClass);
    formSet.removeRow(row);
};

const replaceValues = function(el, target, replacement) {
    // replaces all the target instances in the string attributes of the given element

    if ($(el).prop("for")) {
        $(el).prop("for", $(el).prop("for").replaceAll(target, replacement));
    };

    if (el.id) {
        el.id = el.id.replaceAll(target, replacement);
    };

    if (el.name) {
        el.name = el.name.replaceAll(target, replacement);
    };

    if (el.className) {
        el.classList.forEach(function(class_name) {
            el.classList.toggle(class_name, false);
            el.classList.toggle(class_name.replaceAll(target, replacement), true);
        });
    };

    Object.keys( el.dataset ).forEach(key => {
        el.dataset[key] = el.dataset[key].replaceAll(target, replacement);
    });
};

const formset = function(init_element) {
    // wraps the formset with methods to add, remove and reindex rows.

    // formSet variable from parent init element, if init_element is formset sets it as self
    let formSet = $(init_element).closest("." + formsetClass);
    if (init_element.className && init_element.className.includes(formsetClass)) {
        formSet = $(init_element);
    };

    // properties of formSet, need to be functions as dataset can change if formset is nested inline
    formSet.dataset = function () {return this[0].dataset;};
    formSet.prefix = function () {return this.dataset().prefix;};
    formSet.addButton = function () {return this.find("."+ addButtonClass + "."+ this.prefix());};
    formSet.totalForms = function () {return $("#id_" + this.prefix() + "-TOTAL_FORMS").prop("autocomplete", "off");};
    formSet.maxForms = function () {return $("#id_" + this.prefix() + "-MAX_NUM_FORMS").prop("autocomplete", "off");};
    formSet.minForms = function () {return $("#id_" + this.prefix() + "-MIN_NUM_FORMS").prop("autocomplete", "off");};
    formSet.emptyForm = function () {return $("#" + this.prefix() + "-empty");};
    // '-' after prefix ensures only this level of inlines is beeing targeted
    formSet.allRows = function () {return this.find("." + inlineRowClass + "[id^='" + this.prefix() + "-']")}; // all rows including empty form
    formSet.rows = function () {return this.allRows().not(this.emptyForm())}; // all rows excluding empty form

    formSet.replacePrefix = function (target, replacement) {
        //replace prefix for all inlines, needs to happen before formset or rows do not get found
        this.allRows().each(function(i, row_element) {row(row_element).replacePrefix(target, replacement)});

        // update the prefix of all the normal elemenets of the formset and formset itself
        this.updateNormalElements(target, replacement)
    };

    formSet.updateNormalElements = function(target, replacement) {
        // replace values for all normal elemenets of formset and formset itself
        const normal_elements = $(this).find("*:not(." + inlineRowClass + ")").not($(this).find("." + inlineRowClass).find('*')).add(this)
        normal_elements.each(function (i, e){replaceValues(e, target, replacement)});
    };

    formSet.nextIndex = function () {
        //next index or undefined if max forms is reached

        // number of existing rows
        const total_val = parseInt(this.totalForms().val(), 10);
        const max_val = parseInt(this.maxForms().val(), 10);
        const next_val = (total_val + 1)
        if ((max_val !== '') && (max_val >= next_val)) {
            // indexing starts at 0 values for form count at 1
            return total_val;
        } else {
            return undefined
        };
    };

    formSet.reindex = function (start) {
        // reindex all rows starting from start index
        if (!(typeof start == "number")) {
            start = parseInt(start, 10) || 0
        };
        this.allRows().slice(start).each(function (index, element) {
            row(element).reindex(start + index)
        });

        // update total number of forms
        this.totalForms().val(this.rows().length);

        this.handleAddButton()
        this.handleDeleteButtons()
    };

    formSet.addNewRow = function() {
        // add new row if max forms is not yet reached
        if (this.nextIndex()) {
            const newRow = this.emptyForm().clone(true);
            newRow.removeClass(this.dataset().emptyFormCssClass)
                .attr("id", this.prefix() + "-" + this.nextIndex());
            newRow.insertBefore(this.emptyForm());

            // only reindex from new row onwards
            this.reindex(this.totalForms().val())

            $(document).trigger('formset:added', [newRow, this.prefix()]);
        }
    };
    formSet.minRowsReached = function() {
        const totalVal = parseInt(this.totalForms().val(), 10)
        const minVal = parseInt(this.minForms().val(), 10)

        return totalVal <= minVal
    };

    formSet.removeRow = function (currentRow) {
        // remove specified row
        if (!this.minRowsReached()){
            const index = row(currentRow).currentIndex()
            // for tabular inline, consist of two rows, normal row and error row
            const prevRow = currentRow.prev();
            if (prevRow.length && prevRow.hasClass(errorRowClass)) {
                prevRow.remove();
            }
            currentRow.remove();
            this.reindex(index)

            $(document).trigger('formset:removed', [currentRow, this.prefix()]);
        };
    };

    formSet.handleDeleteButtons = function() {
        // remove delete buttons if min forms is reached, show if there are more than min forms
        if (this.minRowsReached()) {
            this.rows().each(function (i, e) {row(e).deleteButton().hide(0)})
        } else {
            this.rows().each(function (i, e) {row(e).deleteButton().show(0)})
        }

    };

    formSet.handleAddButton = function() {
        // remove add buttons if max forms is reached, show if there are less  than max forms
        return this.nextIndex() === undefined ? this.addButton().hide(0) : this.addButton().show(0);
    };

    formSet.targetAndReplacement = function(index, separator) {
        const target = new RegExp("(" + this.prefix() + separator + "(\\d+|__prefix__))", 'g');
        const replacement = this.prefix() + separator + index;
        return [target, replacement]
    };

    return formSet
};

const row = function(el) {
    // defines jquery object of row itself
    let currentRow = $(el).closest("." + inlineRowClass)
    if (el.className && el.className.includes(inlineRowClass)){
        currentRow = $(el);
    };
    currentRow.formset = function () {return formset(currentRow);};
    currentRow.deleteButton = function() {return this.find("." + deleteButtonClass +"." + this.formset().prefix());};

    currentRow.currentIndex = function() {
        return this[0].id.split("-")[1];
    };

    currentRow.replacePrefix = function (target, replacement) {
        // update the prefix of all the normal elemenets of the row and row itself
        this.updateNormalElements(target, replacement)

        //replace prefix for all nested inlnes
        const nested_inlines = $(this).find("." + formsetClass).not($(this).find("." + formsetClass).find("." + formsetClass))
        nested_inlines.each(function(i, nestedFormset) {formset(nestedFormset).replacePrefix(target, replacement)});
    };

    currentRow.updateNormalElements = function(target, replacement) {
        // replace values for all normal elemenets of row and row itself

        // all child elements of the row that are not inlines itself or children of a nested inline
        const normal_elements = $(this).find("*:not(." + formsetClass + ")").not($(this).find("." + formsetClass).find('*')).add(this)
        normal_elements.each(function (i, e){replaceValues(e, target, replacement)});
    };

    currentRow.updateInlineLabel = function () {
        // changes the header of stacked inline to the new count
        const inlineLabel = this.children().children("." + inlineLabelClass);
        if (inlineLabel.length) {
            $(inlineLabel).html($(inlineLabel).html().replace(/(#\d+|#NaN)/g, "#" + (parseInt(this.currentIndex(), 10) + 1)));
        }
    };

    currentRow.reindex = function (index) {
        // update the index of all the normal elemenets of the row and row itself
        const targetReplacementNormal = formset(this).targetAndReplacement(index, '-') // [0] is target, [1] is replacement
        this.updateNormalElements(targetReplacementNormal[0], targetReplacementNormal[1])

        // update the index of all the nested inlines
        const nestedInlines = $(this).find("." + formsetClass).not($(this).find("." + formsetClass).find("." + formsetClass));
        const targetReplacementNested = formset(this).targetAndReplacement(index, '_')
        nestedInlines.each(function(i, e){row(e).replacePrefix(targetReplacementNested[0], targetReplacementNested[1])});

        this.updateInlineLabel()
    };
    return currentRow;
};


// this following code should be in the corresponding js files
$(document).ready(function() {
    console.log('hey')
    $(document).bind("formset:added", function(e, newRow, prefix) {
        // prepopulated field should subscribe itself to the event in prepopulate.js
        initPrepopulatedFields(newRow, prefix);

        // DateTimeShortCuts should subscribe itself to the event in DateTimeShortCuts.js
        reinitDateTimeShortCuts(newRow, prefix);

        // SelectFilter should subscribe itself to the event in SelectFilter2.js
        updateSelectFilter(newRow, prefix);
    });
});

// legacy functions from original django js code

const reinitDateTimeShortCuts = function(newRow, prefix) {
    // Reinitialize the calendar and clock widgets by force, yuck.
    if (typeof DateTimeShortcuts !== "undefined") {
        newRow.find(".datetimeshortcuts").remove();
        DateTimeShortcuts.init();
    }
};


const updateSelectFilter = function(newRow, prefix) {
    if (typeof SelectFilter !== 'undefined') {
        newRow.find('.selectfilter').each(function(index, value) {
            const namearr = value.name.split('-');
            SelectFilter.init(value.id, namearr[namearr.length - 1], false);
        });
        newRow.find('.selectfilterstacked').each(function(index, value) {
            const namearr = value.name.split('-');
            SelectFilter.init(value.id, namearr[namearr.length - 1], true);
        });
    }
};

//modyfied to work with stacked and tabular inlines
const initPrepopulatedFields = function(newRow, prefix) {
    let additionalClass = ''
    if (formset(newRow).dataset().inlineType == "stacked") {
        additionalClass = ".form-row "
    };
    newRow.find('.prepopulated_field').each(function() {
        const field = $(this),
            input = field.find('input, select, textarea'),
            dependency_list = input.data('dependency_list') || [],
            dependencies = [];
        $.each(dependency_list, function(i, field_name) {
            dependencies.push('#' + newRow.find(additionalClass + '.field-' + field_name).find('input, select, textarea').attr('id'));
        });
        if (dependencies.length) {
            input.prepopulate(dependencies, input.attr('maxlength'));
        }
    });
};