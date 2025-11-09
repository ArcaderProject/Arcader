import { useState } from "react";
import { Button } from "@/components/retroui/Button";
import { ConfirmDialog } from "@/components/retroui/ConfirmDialog";
import { Plus } from "lucide-react";
import { ListsTable } from "./components/ListsTable";
import { CreateListDialog } from "./components/CreateListDialog";
import { EditListDialog } from "./components/EditListDialog";
import { useLists, type GameList } from "./hooks/useLists";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const Lists = () => {
    const navigate = useNavigate();
    const {
        lists,
        selectedList,
        loading,
        createList,
        updateList,
        deleteList,
        selectList,
    } = useLists();

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [activeList, setActiveList] = useState<GameList | null>(null);

    const handleCreateList = async (
        name: string,
        type: "include" | "exclude"
    ) => {
        await createList(name, type);
        toast.success("List created successfully");
    };

    const handleEditList = async (name: string) => {
        if (!activeList) return;
        await updateList(activeList.id, name);
        toast.success("List updated successfully");
    };

    const handleDeleteList = async () => {
        if (!activeList) return;
        await deleteList(activeList.id);
        setDeleteConfirmOpen(false);
        setActiveList(null);
        toast.success("List deleted successfully");
    };

    const handleSelectList = async (list: GameList) => {
        await selectList(list.id);
        toast.success(`Switched to "${list.name}"`);
    };

    const openEditDialog = (list: GameList) => {
        setActiveList(list);
        setEditDialogOpen(true);
    };

    const openManageGames = (list: GameList) => {
        navigate(`/lists/${list.id}/manage`);
    };

    const confirmDelete = (list: GameList) => {
        setActiveList(list);
        setDeleteConfirmOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-xl font-head">LOADING LISTS...</div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-head font-bold">
                        LISTS
                    </h1>
                    {selectedList && (
                        <p className="text-sm font-head mt-2 opacity-70">
                            ACTIVE: {selectedList.name.toUpperCase()}
                        </p>
                    )}
                </div>
                <Button
                    onClick={() => setCreateDialogOpen(true)}
                    className="gap-2"
                >
                    <Plus className="w-5 h-5" />
                    NEW LIST
                </Button>
            </div>

            {lists.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-xl font-head mb-4">NO LISTS FOUND</p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                        CREATE YOUR FIRST LIST
                    </Button>
                </div>
            ) : (
                <ListsTable
                    lists={lists}
                    selectedList={selectedList}
                    onSelect={handleSelectList}
                    onEdit={openEditDialog}
                    onManageGames={openManageGames}
                    onDelete={confirmDelete}
                />
            )}

            <CreateListDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onConfirm={handleCreateList}
            />

            <EditListDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                list={activeList}
                onConfirm={handleEditList}
            />

            <ConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                title="DELETE LIST"
                description={`Are you sure you want to delete "${activeList?.name}"? This action cannot be undone.`}
                confirmLabel="DELETE"
                cancelLabel="CANCEL"
                onConfirm={handleDeleteList}
                variant="destructive"
            />
        </div>
    );
};
