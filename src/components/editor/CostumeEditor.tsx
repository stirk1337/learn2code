import React, { useRef, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useEditorStore } from '@/store/useEditorStore';
import { Costume } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { fileToDataUrl, getImageDimensions } from '@/utils/helpers';
import { Upload, Trash2, Copy } from 'lucide-react';
import { SPRITE_TYPES } from '@/utils/spriteTypes';
import EmptySpritePicker from './EmptySpritePicker';

const CostumeEditor: React.FC = () => {
    const { currentProject, addCostume, removeCostume, updateCostume, reorderCostumes, setSpriteType } = useProjectStore();
    const { selectedSpriteId, isStageSelected } = useEditorStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedCostumeIdx, setSelectedCostumeIdx] = useState<number>(0);
    const [showTypePicker, setShowTypePicker] = useState(false);

    const target = isStageSelected
        ? currentProject?.stage
        : currentProject?.sprites.find(s => s.id === selectedSpriteId);

    if (!target) return <EmptySpritePicker title="Выберите спрайт" description="Добавьте на сцену один из готовых спрайтов и редактируйте его костюм:" />;

    const costumes = target.costumes;
    const targetId = target.id;
    const isStage = 'isStage' in target && target.isStage;
    const label = isStage ? 'Фон' : 'Костюм';
    const currentSpriteType = !isStage && 'type' in target ? target.type : undefined;

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        for (const file of Array.from(files)) {
            const dataUrl = await fileToDataUrl(file);
            const dims = await getImageDimensions(dataUrl);

            const costume: Costume = {
                id: uuidv4(),
                name: file.name.replace(/\.[^/.]+$/, ''),
                dataUrl,
                width: dims.width,
                height: dims.height,
                rotationCenterX: dims.width / 2,
                rotationCenterY: dims.height / 2,
            };

            addCostume(targetId, costume);
        }

        e.target.value = '';
    };

    const handleRename = (costumeId: string, currentName: string) => {
        const newName = prompt('Новое имя:', currentName);
        if (newName && newName !== currentName) {
            updateCostume(targetId, costumeId, { name: newName });
        }
    };

    const handleDelete = (costumeId: string) => {
        if (costumes.length <= 1) {
            alert('Нельзя удалить последний костюм');
            return;
        }
        removeCostume(targetId, costumeId);
        setSelectedCostumeIdx(Math.max(0, selectedCostumeIdx - 1));
    };

    const selectedCostume = costumes[selectedCostumeIdx] || costumes[0];

    return (
        <div className="flex h-full">
            {/* Список костюмов — левая панель */}
            <div className="w-24 bg-gray-50 border-r border-ui-border overflow-y-auto flex flex-col items-center py-2 gap-2">
                {costumes.map((costume, index) => (
                    <div
                        key={costume.id}
                        onClick={() => setSelectedCostumeIdx(index)}
                        className={`relative group cursor-pointer rounded-lg p-1 transition-all w-20 ${
                            selectedCostumeIdx === index
                                ? 'bg-blue-100 border-2 border-scratch-blue'
                                : 'bg-white border-2 border-gray-200 hover:border-gray-400'
                        }`}
                    >
                        {/* Номер */}
                        <div className="absolute -left-1 top-0 text-xs text-gray-400 font-bold">
                            {index + 1}
                        </div>

                        {/* Превью */}
                        <div className="w-full aspect-square flex items-center justify-center overflow-hidden rounded bg-white">
                            <img
                                src={costume.dataUrl}
                                alt={costume.name}
                                className="max-w-full max-h-full object-contain"
                                draggable={false}
                            />
                        </div>

                        {/* Имя */}
                        <div className="text-center text-xs mt-1 truncate font-medium">
                            {costume.name}
                        </div>

                        {/* Размер */}
                        <div className="text-center text-[10px] text-gray-400">
                            {costume.width} × {costume.height}
                        </div>

                        {/* Кнопка удаления */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(costume.id);
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Удалить"
                        >
                            ×
                        </button>
                    </div>
                ))}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUpload}
                    className="hidden"
                />
            </div>

            {/* Основная область — редактор костюма */}
            <div className="flex-1 flex flex-col">
                {/* Панель инструментов */}
                {selectedCostume && (
                    <div className="flex items-center gap-4 px-4 py-2 border-b border-ui-border bg-white">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">{label}:</span>
                            <input
                                type="text"
                                value={selectedCostume.name}
                                onChange={(e) => updateCostume(targetId, selectedCostume.id, { name: e.target.value })}
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
                            />
                        </div>

                        {!isStage && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowTypePicker(v => !v)}
                                    className="px-3 py-1 text-sm rounded-[8px] border border-[#E0E4EB] text-[#1A1D2D] bg-white hover:bg-gray-50 transition-colors"
                                    title="Выбрать тип спрайта"
                                >
                                    Выбрать костюм
                                    {currentSpriteType && (
                                        <span className="ml-2 text-xs text-[#6B7280]">
                                            ({SPRITE_TYPES.find(t => t.type === currentSpriteType)?.name})
                                        </span>
                                    )}
                                </button>

                                {showTypePicker && (
                                    <div className="absolute z-20 mt-2 left-0 bg-white border border-[#E0E4EB] rounded-[12px] shadow-lg p-2 flex gap-2">
                                        {SPRITE_TYPES.map(t => {
                                            const isSelected = currentSpriteType === t.type;
                                            return (
                                                <button
                                                    key={t.type}
                                                    onClick={() => {
                                                        setSpriteType(targetId, t.type);
                                                        setSelectedCostumeIdx(0);
                                                        setShowTypePicker(false);
                                                    }}
                                                    className={`flex flex-col items-center gap-1 p-2 rounded-[8px] w-24 transition-colors ${
                                                        isSelected
                                                            ? 'bg-[#EDE7FF] border border-[#734DE6]'
                                                            : 'border border-transparent hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <img
                                                        src={t.assetUrl}
                                                        alt={t.name}
                                                        className="w-12 h-12 object-contain"
                                                        draggable={false}
                                                    />
                                                    <span className="text-xs font-medium text-[#1A1D2D]">{t.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-1 ml-auto">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 hover:bg-gray-100 rounded transition-colors"
                                title="Загрузить"
                            >
                                <Upload size={18} className="text-gray-600" />
                            </button>
                            <button
                                onClick={() => {
                                    const dup: Costume = {
                                        ...selectedCostume,
                                        id: uuidv4(),
                                        name: selectedCostume.name + ' копия',
                                    };
                                    addCostume(targetId, dup);
                                }}
                                className="p-2 hover:bg-gray-100 rounded transition-colors"
                                title="Копировать"
                            >
                                <Copy size={18} className="text-gray-600" />
                            </button>
                            <button
                                onClick={() => handleDelete(selectedCostume.id)}
                                className="p-2 hover:bg-gray-100 rounded transition-colors"
                                title="Удалить"
                            >
                                <Trash2 size={18} className="text-gray-600" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Область просмотра костюма */}
                <div className="flex-1 flex items-center justify-center bg-white p-4 overflow-auto">
                    {selectedCostume ? (
                        <div className="relative" style={{ maxWidth: '100%', maxHeight: '100%' }}>
                            {/* Шахматный фон для прозрачности */}
                            <div
                                className="absolute inset-0 opacity-10"
                                style={{
                                    backgroundImage: `
                    linear-gradient(45deg, #ccc 25%, transparent 25%),
                    linear-gradient(-45deg, #ccc 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #ccc 75%),
                    linear-gradient(-45deg, transparent 75%, #ccc 75%)
                  `,
                                    backgroundSize: '20px 20px',
                                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                                }}
                            />
                            <img
                                src={selectedCostume.dataUrl}
                                alt={selectedCostume.name}
                                className="relative max-w-full max-h-[500px] object-contain"
                                draggable={false}
                            />
                            {/* Центр вращения */}
                            <div
                                className="absolute w-3 h-3 border-2 border-blue-500 rounded-full bg-white"
                                style={{
                                    left: `${(selectedCostume.rotationCenterX / selectedCostume.width) * 100}%`,
                                    top: `${(selectedCostume.rotationCenterY / selectedCostume.height) * 100}%`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                                title="Центр вращения"
                            />
                        </div>
                    ) : (
                        <div className="text-gray-400">Нет костюмов</div>
                    )}
                </div>

                {/* Инструменты рисования (заглушка) */}
                <div className="h-10 border-t border-ui-border bg-gray-50 flex items-center px-4">
          <span className="text-xs text-gray-400">
            Встроенный редактор изображений будет доступен в следующей версии.
            Пока используйте загрузку готовых изображений.
          </span>
                </div>
            </div>
        </div>
    );
};

export default CostumeEditor;