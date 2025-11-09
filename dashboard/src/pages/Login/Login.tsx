import { useState } from "react";
import { Card } from "@/components/retroui/Card";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { User, Lock, LogIn } from "lucide-react";
import banner from "@/common/assets/banner.png";

export const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 1500);
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md flex flex-col items-center justify-center">
                <div className="text-center mb-8 w-full">
                    <img 
                        src={banner} 
                        alt="Arcader" 
                        className="mx-auto max-w-full h-auto"
                    />
                </div>

                <Card className="border-4 border-foreground bg-card overflow-hidden w-full">
                    <Card.Content className="space-y-4 p-6">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-head font-semibold text-foreground">
                                    USERNAME
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Enter username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="font-sans pl-11 bg-background"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-head font-semibold text-foreground">
                                    PASSWORD
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input
                                        type="password"
                                        placeholder="Enter password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="font-sans pl-11 bg-background"
                                        required
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                variant="default"
                                size="lg"
                                className="w-full mt-6 font-bold tracking-wider gap-2"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    "LOADING..."
                                ) : (
                                    <>
                                        <LogIn className="w-5 h-5" />
                                        LOGIN
                                    </>
                                )}
                            </Button>
                        </form>
                    </Card.Content>
                </Card>
            </div>
        </div>
    );
}