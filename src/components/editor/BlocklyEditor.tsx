import React, { useEffect, useRef, useCallback } from 'react';
import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';
import { initBlocklyWorkspace, loadWorkspaceFromXml, getWorkspaceXml } from '@/blockly/setup';
import { useProjectStore } from '@/store/useProjectStore';
import { useEditorStore } from '@/store/useEditorStore';
import '../../blockly/generators/python';

const BlocklyEditor: React.FC = () => {
    console.log('[BlocklyEditor] COMPONENT ENTER');
    const containerRef = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
    const hasInitializedRef = useRef(false);
    const currentTargetIdRef = useRef<string | null>(null);
    const loadedTargetIdRef = useRef<string | null>(null);
    const loadedXmlRef = useRef<string>('');
    const updateBlocksRef = useRef(useProjectStore.getState().updateBlocks);
    const { currentProject, updateBlocks } = useProjectStore();
    const { selectedSpriteId, isStageSelected } = useEditorStore();
    console.log('[BlocklyEditor] Hooks called, currentProject exists:', !!currentProject);

    const currentTargetId = isStageSelected
        ? currentProject?.stage.id
        : selectedSpriteId;

    const currentBlocks = isStageSelected
        ? currentProject?.stage.blocks
        : currentProject?.sprites.find(s => s.id === selectedSpriteId)?.blocks;

    // Устанавливаем ref синхронно при рендере, чтобы он был доступен в useEffect
    currentTargetIdRef.current = currentTargetId ?? null;
    updateBlocksRef.current = updateBlocks;

    console.log('[BlocklyEditor] Render - currentTargetId:', currentTargetId, 'selectedSpriteId:', selectedSpriteId, 'isStageSelected:', isStageSelected, 'ref set to:', currentTargetIdRef.current);

    const exportBlocksJson = useCallback(() => {
        const workspace = workspaceRef.current;
        if (!workspace) return;

        const data = Blockly.serialization.workspaces.save(workspace);
        const payload = JSON.stringify(data, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'blocks.json';
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    const exportPythonCode = useCallback(() => {
        const workspace = workspaceRef.current;
        if (!workspace) return;

        const code = pythonGenerator.workspaceToCode(workspace);

        const blob = new Blob([code], { type: 'text/x-python' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'program.py';
        a.click();

        URL.revokeObjectURL(url);
    }, []);

    useEffect(() => {
        if (!containerRef.current || hasInitializedRef.current) return;

        console.log('[BlocklyEditor] Initializing workspace, currentTargetIdRef:', currentTargetIdRef.current);

        workspaceRef.current = initBlocklyWorkspace(containerRef.current, (xml) => {
            const targetId = currentTargetIdRef.current;
            console.log('[BlocklyEditor] onChange callback - targetId:', targetId, 'xml length:', xml?.length);
            if (!targetId) {
                console.warn('[BlocklyEditor] No targetId, skipping save');
                return;
            }

            loadedTargetIdRef.current = targetId;
            loadedXmlRef.current = xml;
            console.log('[BlocklyEditor] Calling updateBlocks for target:', targetId);
            updateBlocksRef.current(targetId, xml);
        });

        const flyout = workspaceRef.current.getFlyout();
        if (flyout && 'scrollbar' in flyout) {
            const anyFlyout = flyout as unknown as { scrollbar?: { setVisible?: (visible: boolean) => void } };
            anyFlyout.scrollbar?.setVisible?.(false);
        }
        requestAnimationFrame(() => {
            const flyoutAgain = workspaceRef.current?.getFlyout();
            if (flyoutAgain && 'scrollbar' in flyoutAgain) {
                const anyFlyoutAgain = flyoutAgain as unknown as { scrollbar?: { setVisible?: (visible: boolean) => void } };
                anyFlyoutAgain.scrollbar?.setVisible?.(false);
            }
        });
        hasInitializedRef.current = true;

        return () => {
            workspaceRef.current?.dispose();
            workspaceRef.current = null;
            hasInitializedRef.current = false;
            loadedTargetIdRef.current = null;
            loadedXmlRef.current = '';
        };
    }, []);

    useEffect(() => {
        const workspace = workspaceRef.current;
        if (!workspace || !currentTargetId) return;

        // Получаем актуальные блоки прямо из стора (не из замыкания)
        const project = useProjectStore.getState().currentProject;
        let blocks: string | undefined;
        
        if (isStageSelected) {
            blocks = project?.stage.blocks;
        } else {
            blocks = project?.sprites.find(s => s.id === selectedSpriteId)?.blocks;
        }

        console.log('=== Switching sprite ===', { currentTargetId, loadedTargetId: loadedTargetIdRef.current, blocks });

        // Всегда загружаем блоки при смене спрайта, даже если empty
        loadedTargetIdRef.current = currentTargetId;
        loadedXmlRef.current = blocks || '';
        loadWorkspaceFromXml(workspace, blocks || '');
    }, [currentTargetId, isStageSelected, selectedSpriteId]);

    useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (workspaceRef.current) {
                Blockly.svgResize(workspaceRef.current);
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div className="relative w-full h-full">
            <div className="absolute top-2 right-2 z-20 flex gap-2">
                <button
                    type="button"
                    onClick={exportBlocksJson}
                    className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow hover:bg-gray-50"
                >
                    Скачать JSON
                </button>
                <button
                    type="button"
                    onClick={exportPythonCode}
                    className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-blue-600"
                >
                    Скачать Python
                </button>
            </div>
            <div
                ref={containerRef}
                className="w-full h-full"
                style={{ minHeight: '400px' }}
            />
        </div>
    );
};

export default BlocklyEditor;
