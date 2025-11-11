import { Loader as UILoader} from "@/components/retroui/Loader";

export const Loader = () => {
    return (
        <div className="flex h-screen items-center justify-center">
            <UILoader className="scale-[3]"/>
        </div>
    )
}