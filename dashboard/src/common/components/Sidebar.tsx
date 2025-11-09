import {Text} from "@/components/retroui/Text.tsx";

export const Sidebar = () => {
    return (
        <div className="w-64 h-full p-4">
            <Text className="text-lg font-bold">Sidebar</Text>

            <div className="mt-4">
                <Text className="block py-2 px-4 rounded hover:bg-gray-200 cursor-pointer">Home</Text>
                <Text className="block py-2 px-4 rounded hover:bg-gray-200 cursor-pointer">Profile</Text>
                <Text className="block py-2 px-4 rounded hover:bg-gray-200 cursor-pointer">Settings</Text>
            </div>
        </div>
    )
}