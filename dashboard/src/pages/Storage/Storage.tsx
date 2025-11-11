import {useState, useEffect} from "react";
import {Button} from "@/components/retroui/Button";
import {ConfirmDialog} from "@/components/retroui/ConfirmDialog";
import {Plus} from "lucide-react";
import {getRequest, postRequest, putRequest, deleteRequest} from "@/common/utils/RequestUtil";
import {toast} from "sonner";
import {StorageList, type SaveFolder} from "./components/StorageList";
import {CreateStorageDialog} from "./components/CreateStorageDialog";
import {RenameStorageDialog} from "./components/RenameStorageDialog";

export const Storage = () => {
    const [folders, setFolders] = useState<SaveFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<SaveFolder | null>(null);
    const [newFolderName, setNewFolderName] = useState("");

    const loadFolders = async () => {
        try {
            setLoading(true);
            const data = await getRequest("save-folders");
            setFolders(data);
        } catch (error: any) {
            console.error("Failed to load save folders:", error);
            toast.error("Failed to load save folders");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFolders();
    }, []);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        try {
            await postRequest("save-folders", {name: newFolderName.trim()});
            toast.success(`Created save folder "${newFolderName}"`);
            setNewFolderName("");
            setCreateDialogOpen(false);
            await loadFolders();
        } catch (error: any) {
            console.error("Failed to create folder:", error);
            toast.error("Failed to create save folder");
        }
    };

    const handleRenameFolder = async () => {
        if (!selectedFolder || !newFolderName.trim()) return;

        try {
            await putRequest(`save-folders/${selectedFolder.uuid}`, {
                name: newFolderName.trim(),
            });
            toast.success(`Renamed to "${newFolderName}"`);
            setNewFolderName("");
            setRenameDialogOpen(false);
            await loadFolders();
        } catch (error: any) {
            console.error("Failed to rename folder:", error);
            if (error.error === "Cannot rename global profile") {
                toast.error("Cannot rename global profile");
            } else {
                toast.error("Failed to rename save folder");
            }
        }
    };

    const handleActivateFolder = async (folder: SaveFolder) => {
        try {
            await postRequest(`save-folders/${folder.uuid}/activate`, {});
            toast.success(`Activated "${folder.name}"`);
            await loadFolders();
        } catch (error: any) {
            console.error("Failed to activate folder:", error);
            toast.error("Failed to activate save folder");
        }
    };

    const handleToggleLock = async (folder: SaveFolder) => {
        try {
            const endpoint = folder.isLocked ? "unlock" : "lock";
            await postRequest(`save-folders/${folder.uuid}/${endpoint}`, {});
            toast.success(
                folder.isLocked
                    ? `Unlocked "${folder.name}"`
                    : `Locked "${folder.name}"`
            );
            await loadFolders();
        } catch (error: any) {
            console.error("Failed to toggle lock:", error);
            toast.error("Failed to update save folder");
        }
    };

    const handleClearFolder = async () => {
        if (!selectedFolder) return;

        try {
            const response = await postRequest(`save-folders/${selectedFolder.uuid}/clear`, {});
            const deletedCount = response.deletedCount || 0;

            if (deletedCount > 0) {
                toast.success(`Cleared ${deletedCount} item(s) from "${selectedFolder.name}"`);
            } else {
                toast.info(`"${selectedFolder.name}" was already empty`);
            }

            setClearConfirmOpen(false);
            await loadFolders();
        } catch (error: any) {
            console.error("Failed to clear folder:", error);
            if (error.error === "Cannot clear a locked save folder") {
                toast.error("Cannot clear a locked save folder");
            } else {
                toast.error("Failed to clear save folder");
            }
        }
    };

    const handleDeleteFolder = async () => {
        if (!selectedFolder) return;

        try {
            await deleteRequest(`save-folders/${selectedFolder.uuid}`);
            toast.success(`Deleted "${selectedFolder.name}"`);
            setDeleteConfirmOpen(false);
            await loadFolders();
        } catch (error: any) {
            console.error("Failed to delete folder:", error);
            if (error.error === "Cannot delete global profile") {
                toast.error("Cannot delete global profile");
            } else {
                toast.error("Failed to delete save folder");
            }
        }
    };

    const openRenameDialog = (folder: SaveFolder) => {
        setSelectedFolder(folder);
        setNewFolderName(folder.name);
        setRenameDialogOpen(true);
    };

    const openClearConfirm = (folder: SaveFolder) => {
        setSelectedFolder(folder);
        setClearConfirmOpen(true);
    };

    const openDeleteConfirm = (folder: SaveFolder) => {
        setSelectedFolder(folder);
        setDeleteConfirmOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-xl font-head">LOADING STORAGE...</div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex justify-end items-center mb-6">
                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                    <Plus className="w-5 h-5"/>
                    NEW STORAGE
                </Button>
            </div>

            <StorageList folders={folders} onActivate={handleActivateFolder} onRename={openRenameDialog}
                         onToggleLock={handleToggleLock} onClear={openClearConfirm} onDelete={openDeleteConfirm} />

            <CreateStorageDialog
                open={createDialogOpen}
                onOpenChange={(open) => {
                    setCreateDialogOpen(open);
                    if (!open) setNewFolderName("");
                }}
                name={newFolderName}
                onNameChange={setNewFolderName}
                onConfirm={handleCreateFolder}
            />

            <RenameStorageDialog
                open={renameDialogOpen}
                onOpenChange={(open) => {
                    setRenameDialogOpen(open);
                    if (!open) setNewFolderName("");
                }}
                name={newFolderName}
                onNameChange={setNewFolderName}
                onConfirm={handleRenameFolder}
            />

            <ConfirmDialog
                open={clearConfirmOpen}
                onOpenChange={setClearConfirmOpen}
                title="CLEAR SAVE STATES"
                description={`Are you sure you want to clear all save states from "${selectedFolder?.name}"? This will delete all save files and cannot be undone.${selectedFolder?.isLocked ? ' Note: This folder is locked, so new saves are read-only.' : ''}`}
                confirmLabel="CLEAR"
                cancelLabel="CANCEL"
                onConfirm={handleClearFolder}
                variant="destructive"
            />

            <ConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                title="DELETE STORAGE"
                description={`Are you sure you want to delete "${selectedFolder?.name}"? This will permanently remove the folder and all its save states. This action cannot be undone.`}
                confirmLabel="DELETE"
                cancelLabel="CANCEL"
                onConfirm={handleDeleteFolder}
                variant="destructive"
            />
        </div>
    );
};
