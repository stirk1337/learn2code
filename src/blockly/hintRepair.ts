import * as Blockly from 'blockly';
import type { HintPatchPlan, HintRepairExpression, HintRepairGraphEdit, HintRepairOperation } from '@/services/api';

// Применение публичного плана L3 к XML рабочей области. Повторяет серверный
// HintRepairWorkspaceCodec/HintActionGraphEditor: существующие ID сохраняются,
// новые блоки получают ID, назначенные сервером.

const ACTIONS = {
    move: ['motion_movesteps', 'STEPS'],
    turn: ['motion_turnright', 'DEGREES'],
    say: ['looks_say', 'MESSAGE'],
} as const;

const OPERATORS: Record<string, string> = {
    operator_add: '+',
    operator_subtract: '−',
    operator_multiply: '×',
    operator_divide: '÷',
    operator_gt: '>',
    operator_lt: '<',
    operator_equals: '=',
    operator_and: 'и',
    operator_or: 'или',
};

const children = (el: Element) => Array.from(el.children);
const child = (el: Element, tag: string, name?: string) =>
    children(el).find(c => c.localName === tag && (name === undefined || c.getAttribute('name') === name)) ?? null;

const findBlock = (doc: Document, id: string): Element => {
    const found = Array.from(doc.getElementsByTagName('*')).find(
        e => (e.localName === 'block' || e.localName === 'shadow') && e.getAttribute('id') === id
    );
    if (!found) throw new Error(`Блок ${id} не найден — код изменился`);
    return found;
};

const make = (doc: Document, tag: string, attrs: Record<string, string>, ...kids: (Node | string)[]) => {
    const el = doc.createElementNS(doc.documentElement.namespaceURI, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    kids.forEach(k => el.append(k));
    return el;
};

const setField = (block: Element, name: string, value: string) => {
    const field = child(block, 'field', name);
    if (!field) throw new Error(`Поле ${name} не найдено`);
    field.textContent = value;
    return field;
};

// Блок, стоящий на месте `from`, переносит координаты верхнего уровня.
const replaceWith = (from: Element, to: Element) => {
    ['x', 'y'].forEach(a => {
        const v = from.getAttribute(a);
        if (v !== null) {
            to.setAttribute(a, v);
            from.removeAttribute(a);
        }
    });
    from.replaceWith(to);
};

const expression = (doc: Document, e: HintRepairExpression, id: string): Element => {
    const field = (name: string, v: string) => make(doc, 'field', { name }, v);
    switch (e.valueKind) {
        case 'number':
            return make(doc, 'block', { id, type: 'math_number' }, field('NUM', String(e.value)));
        case 'text':
            return make(doc, 'block', { id, type: 'text' }, field('TEXT', e.value));
        case 'variable':
            return make(doc, 'block', { id, type: 'data_variable' }, field('VARIABLE', e.name));
        case 'binary':
            return make(
                doc,
                'block',
                { id, type: e.blockType },
                make(doc, 'value', { name: 'NUM1' }, expression(doc, e.left, `${id}_l`)),
                make(doc, 'value', { name: 'NUM2' }, expression(doc, e.right, `${id}_r`))
            );
    }
};

const insertAfter = (doc: Document, anchor: Element, block: Element) => {
    const next = child(anchor, 'next');
    if (next) {
        next.remove();
        block.append(next);
    }
    anchor.append(make(doc, 'next', {}, block));
};

const applyEdit = (doc: Document, edit: HintRepairGraphEdit) => {
    switch (edit.editKind) {
        case 'literal':
            setField(findBlock(doc, edit.blockId), edit.fieldName, edit.afterValue);
            return;
        case 'operator':
            findBlock(doc, edit.blockId).setAttribute('type', edit.afterType);
            return;
        case 'variable_use': {
            const field = setField(findBlock(doc, edit.blockId), 'VARIABLE', edit.afterName);
            const variable = Array.from(doc.getElementsByTagName('*')).find(
                e => e.localName === 'variable' && e.textContent === edit.afterName
            );
            if (variable?.getAttribute('id')) field.setAttribute('id', variable.getAttribute('id')!);
            else field.removeAttribute('id');
            return;
        }
        case 'wrap_repeat': {
            const first = findBlock(doc, edit.blockId);
            const last = findBlock(doc, edit.lastBlockId);
            const tail = child(last, 'next');
            tail?.remove();
            const loop = make(
                doc,
                'block',
                { id: edit.loopBlockId, type: 'control_repeat' },
                make(
                    doc,
                    'value',
                    { name: 'TIMES' },
                    make(doc, 'shadow', { id: edit.countBlockId, type: 'math_number' }, make(doc, 'field', { name: 'NUM' }, String(edit.count)))
                )
            );
            replaceWith(first, loop);
            loop.append(make(doc, 'statement', { name: 'SUBSTACK' }, first));
            if (tail) loop.append(tail);
            return;
        }
        case 'insert_action': {
            const [type, input] = ACTIONS[edit.operation];
            const block = make(
                doc,
                'block',
                { id: edit.newBlockId, type },
                make(doc, 'value', { name: input }, expression(doc, edit.argument, `${edit.newBlockId}_v`))
            );
            const { parentBlockId, branch, previousBlockId, nextBlockId } = edit.position;
            if (previousBlockId) {
                insertAfter(doc, findBlock(doc, previousBlockId), block);
            } else if (nextBlockId) {
                const next = findBlock(doc, nextBlockId);
                replaceWith(next, block);
                block.append(make(doc, 'next', {}, next));
            } else {
                // Пустое тело: родитель — указанный блок или флаг верхнего уровня.
                const owner = parentBlockId
                    ? findBlock(doc, parentBlockId)
                    : children(doc.documentElement).find(e => e.localName === 'block');
                if (!owner) throw new Error('Не найден блок для вставки');
                const name = !parentBlockId ? 'STACK' : branch === 'orelse' ? 'SUBSTACK2' : 'SUBSTACK';
                const statement = child(owner, 'statement', name) ?? owner.appendChild(make(doc, 'statement', { name }));
                statement.append(block);
            }
            return;
        }
    }
};

const applyOperation = (doc: Document, op: HintRepairOperation) => {
    switch (op.kind) {
        case 'swap_adjacent': {
            const first = findBlock(doc, op.firstBlockId);
            const firstNext = child(first, 'next');
            const second = firstNext && children(firstNext)[0];
            if (!second || second.getAttribute('id') !== op.secondBlockId) throw new Error('Блоки больше не стоят рядом');
            const tail = child(second, 'next');
            tail?.remove();
            firstNext.remove();
            replaceWith(first, second);
            second.append(make(doc, 'next', {}, first));
            if (tail) first.append(tail);
            return;
        }
        case 'set_number':
            setField(findBlock(doc, op.fieldBlockId), op.fieldName, op.afterValue);
            return;
        case 'insert_say_after': {
            const text = make(doc, 'field', { name: op.textFieldName }, op.text);
            const block = make(doc, 'block', { id: op.blockId, type: op.blockType });
            if (op.inputName && op.valueBlockId && op.valueBlockType) {
                block.append(
                    make(doc, 'value', { name: op.inputName }, make(doc, 'block', { id: op.valueBlockId, type: op.valueBlockType }, text))
                );
            } else {
                block.append(text);
            }
            insertAfter(doc, findBlock(doc, op.anchorBlockId), block);
            return;
        }
        case 'graph_patch':
            op.edits.forEach(e => applyEdit(doc, e));
            return;
    }
};

export const applyPlanToXml = (xml: string, plan: HintPatchPlan): string => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Некорректный XML');
    plan.operations.forEach(op => applyOperation(doc, op));
    return new XMLSerializer().serializeToString(doc);
};

// Одна группа событий — одно «Отменить» (Ctrl+Z).
export const applyPlanToWorkspace = (workspace: Blockly.WorkspaceSvg, plan: HintPatchPlan) => {
    const xml = applyPlanToXml(Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)), plan);
    Blockly.Events.setGroup(true);
    try {
        workspace.clear();
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), workspace);
    } finally {
        Blockly.Events.setGroup(false);
    }
};

// ---------- Описание шагов для ученика ----------

type Label = (blockId: string) => string;

const exprText = (e: HintRepairExpression): string => {
    switch (e.valueKind) {
        case 'number':
            return String(e.value);
        case 'text':
            return `"${e.value}"`;
        case 'variable':
            return e.name;
        case 'binary':
            return `${exprText(e.left)} ${OPERATORS[e.blockType] ?? '?'} ${exprText(e.right)}`;
    }
};

const ACTION_TEXT = { move: 'идти %s шагов', turn: 'повернуть на %s°', say: 'сказать %s' };

const describeEdit = (e: HintRepairGraphEdit, label: Label): string => {
    switch (e.editKind) {
        case 'literal':
            return `В блоке «${label(e.blockId)}» замени «${e.beforeValue}» на «${e.afterValue}».`;
        case 'operator':
            return `Замени операцию «${OPERATORS[e.beforeType] ?? e.beforeType}» на «${OPERATORS[e.afterType] ?? e.afterType}».`;
        case 'variable_use':
            return `Используй переменную «${e.afterName}» вместо «${e.beforeName}».`;
        case 'wrap_repeat':
            return e.blockId === e.lastBlockId
                ? `Помести блок «${label(e.blockId)}» внутрь «повторить ${e.count} раз».`
                : `Помести блоки от «${label(e.blockId)}» до «${label(e.lastBlockId)}» внутрь «повторить ${e.count} раз».`;
        case 'insert_action': {
            const block = ACTION_TEXT[e.operation].replace('%s', exprText(e.argument));
            const { previousBlockId, nextBlockId } = e.position;
            if (previousBlockId) return `Добавь «${block}» после блока «${label(previousBlockId)}».`;
            if (nextBlockId) return `Добавь «${block}» перед блоком «${label(nextBlockId)}».`;
            return `Добавь блок «${block}».`;
        }
    }
};

export const describePlan = (plan: HintPatchPlan, label: Label): string[] =>
    plan.operations.flatMap(op => {
        switch (op.kind) {
            case 'swap_adjacent':
                return [`Поменяй местами блоки «${label(op.firstBlockId)}» и «${label(op.secondBlockId)}».`];
            case 'set_number':
                return [`В блоке «${label(op.statementBlockId)}» замени ${op.beforeValue} на ${op.afterValue}.`];
            case 'insert_say_after':
                return [`Добавь «сказать "${op.text}"» после блока «${label(op.anchorBlockId)}».`];
            case 'graph_patch':
                return op.edits.map(e => describeEdit(e, label));
        }
    });

// ID существующих блоков, которые затронет план — для подсветки.
export const planBlockIds = (plan: HintPatchPlan): string[] =>
    plan.operations.flatMap(op => {
        switch (op.kind) {
            case 'swap_adjacent':
                return [op.firstBlockId, op.secondBlockId];
            case 'set_number':
                return [op.statementBlockId];
            case 'insert_say_after':
                return [op.anchorBlockId];
            case 'graph_patch':
                return op.edits.map(e => e.blockId);
        }
    });
