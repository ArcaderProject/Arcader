import { useState } from "react";
import { Button } from "@/components/retroui/Button";
import { ConfirmDialog } from "@/components/retroui/ConfirmDialog";
import { Plus } from "lucide-react";
import { ProfilesTable } from "./components/ProfilesTable";
import { ProfileDialog } from "./components/ProfileDialog";
import {
    useControllerProfiles,
    type ControllerProfile,
} from "./hooks/useControllerProfiles";
import { toast } from "sonner";

export const ControllerProfiles = () => {
    const {
        profiles,
        loading,
        createProfile,
        updateProfile,
        deleteProfile,
        configureProfile,
    } = useControllerProfiles();

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [activeProfile, setActiveProfile] = useState<ControllerProfile | null>(
        null,
    );

    const handleCreate = async (name: string) => {
        await createProfile(name);
        toast.success("Profile created successfully");
    };

    const handleRename = async (name: string) => {
        if (!activeProfile) return;
        await updateProfile(activeProfile.id, name);
        toast.success("Profile renamed successfully");
    };

    const handleDelete = async () => {
        if (!activeProfile) return;
        await deleteProfile(activeProfile.id);
        setDeleteConfirmOpen(false);
        setActiveProfile(null);
        toast.success("Profile deleted successfully");
    };

    const handleConfigure = async (profile: ControllerProfile) => {
        setActiveProfile(profile);
        try {
            await configureProfile(profile.id);
            toast.success(
                "Configuration started on the arcade machine. Follow the on-screen prompts.",
            );
        } catch (err: any) {
            toast.error(err?.error || "Failed to start configuration");
        }
    };

    const openRename = (profile: ControllerProfile) => {
        setActiveProfile(profile);
        setRenameDialogOpen(true);
    };

    const confirmDelete = (profile: ControllerProfile) => {
        setActiveProfile(profile);
        setDeleteConfirmOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-xl font-head">LOADING PROFILES...</div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-head font-bold">
                        CONTROLLERS
                    </h1>
                    <p className="text-sm font-head mt-2 opacity-70">
                        Map your joysticks &amp; buttons, then assign layouts to
                        games
                    </p>
                </div>
                <Button
                    onClick={() => setCreateDialogOpen(true)}
                    className="gap-2"
                >
                    <Plus className="w-5 h-5" />
                    NEW PROFILE
                </Button>
            </div>

            <ProfilesTable
                profiles={profiles}
                onConfigure={handleConfigure}
                onEdit={openRename}
                onDelete={confirmDelete}
            />

            <ProfileDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                mode="create"
                onConfirm={handleCreate}
            />

            <ProfileDialog
                open={renameDialogOpen}
                onOpenChange={setRenameDialogOpen}
                mode="rename"
                initialName={activeProfile?.name}
                onConfirm={handleRename}
            />

            <ConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                title="DELETE PROFILE"
                description={`Are you sure you want to delete "${activeProfile?.name}"? Games using it will fall back to the default profile. This cannot be undone.`}
                confirmLabel="DELETE"
                cancelLabel="CANCEL"
                onConfirm={handleDelete}
                variant="destructive"
            />
        </div>
    );
};
