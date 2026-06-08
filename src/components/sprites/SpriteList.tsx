import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useProjectStore } from '@/store/useProjectStore';
import { useEditorStore } from '@/store/useEditorStore';
import { Plus } from 'lucide-react';
import { SPRITE_TYPES } from '@/utils/spriteTypes';

interface SpriteListProps {
    readOnly?: boolean;
}

const SpriteList: React.FC<SpriteListProps> = ({ readOnly = false }) => {
    const { currentProject, addSpriteOfType, removeSprite, duplicateSprite } = useProjectStore();
    const { selectedSpriteId, selectSprite } = useEditorStore();
    const [showPicker, setShowPicker] = useState(false);
    const [pickerPos, setPickerPos] = useState<{ right: number; bottom: number }>({ right: 0, bottom: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const openPicker = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) {
            setPickerPos({
                right: window.innerWidth - rect.right,
                bottom: window.innerHeight - rect.top + 8,
            });
        }
        setShowPicker(v => !v);
    };

    useEffect(() => {
        if (!showPicker) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                menuRef.current && !menuRef.current.contains(target) &&
                buttonRef.current && !buttonRef.current.contains(target)
            ) {
                setShowPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPicker]);

    if (!currentProject) return null;

    const sprites = currentProject.sprites;

    const handlePickType = (type: typeof SPRITE_TYPES[number]['type']) => {
        const id = addSpriteOfType(type);
        selectSprite(id);
        setShowPicker(false);
    };

    const handleContextMenu = (e: React.MouseEvent, spriteId: string) => {
        e.preventDefault();
        const action = window.confirm('Удалить спрайт?');
        if (action) {
            removeSprite(spriteId);
        }
    };

    return (
        <div className="relative flex flex-col h-full">
            {/* Список спрайтов */}
            <div className="flex-1 overflow-y-auto p-2 pb-14 flex flex-wrap gap-2 content-start">
                {sprites.map((sprite) => {
                    const costume = sprite.costumes[sprite.currentCostume];
                    const isSelected = selectedSpriteId === sprite.id;

                    return (
                        <div
                            key={sprite.id}
                            onClick={() => selectSprite(sprite.id)}
                            onContextMenu={readOnly ? undefined : (e) => handleContextMenu(e, sprite.id)}
                            className={`relative group ${
                                isSelected ? 'sprite-thumb-active' : 'sprite-thumb-inactive'
                            }`}
                        >
                            {/* Превью */}
                            <div className="w-full h-14 flex items-center justify-center overflow-hidden">
                                {costume && (
                                    <img
                                        src={costume.dataUrl}
                                        alt={sprite.name}
                                        className="max-w-full max-h-full object-contain"
                                        draggable={false}
                                    />
                                )}
                            </div>

                            {/* Имя */}
                            <div className="text-center text-[10px] font-medium truncate px-1 mt-1">
                                {sprite.name}
                            </div>

                            {/* Кнопка удаления - только если не readOnly */}
                            {!readOnly && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeSprite(sprite.id);
                                    }}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                    ×
                                </button>
                            )}

                            {/* Кнопка дублирования - только если не readOnly */}
                            {!readOnly && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        duplicateSprite(sprite.id);
                                    }}
                                    className="absolute -top-1 -left-1 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    title="Дублировать"
                                >
                                    ⊕
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Кнопка добавления — плавающая в углу области списка */}
            {!readOnly && (
                <button
                    ref={buttonRef}
                    onClick={openPicker}
                    className="absolute bottom-2 right-2 w-10 h-10 bg-scratch-blue text-white rounded-full flex items-center justify-center hover:bg-scratch-blue-dark transition-colors shadow-md z-10"
                    title="Добавить спрайт"
                >
                    <Plus size={20} />
                </button>
            )}

            {/* Выбор типа спрайта — через портал, чтобы не обрезался overflow-контейнерами */}
            {!readOnly && showPicker && createPortal(
                <div
                    ref={menuRef}
                    className="fixed bg-white border border-[#E0E4EB] rounded-[12px] shadow-lg p-2 flex gap-2 z-50"
                    style={{ right: pickerPos.right, bottom: pickerPos.bottom }}
                >
                    {SPRITE_TYPES.map(t => (
                        <button
                            key={t.type}
                            onClick={() => handlePickType(t.type)}
                            className="flex flex-col items-center gap-1 p-2 rounded-[8px] w-20 border border-transparent hover:border-[#734DE6] hover:bg-[#F8FAFB] transition-colors"
                            title={t.name}
                        >
                            <img
                                src={t.assetUrl}
                                alt={t.name}
                                className="w-12 h-12 object-contain"
                                draggable={false}
                            />
                            <span className="text-xs font-medium text-[#1A1D2D]">{t.name}</span>
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default SpriteList;