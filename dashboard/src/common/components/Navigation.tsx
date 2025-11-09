import { Button } from "@/components/retroui/Button.tsx";
import { useContext, useState } from "react";
import { AuthContext } from "@/common/contects/AuthProvider.tsx";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Settings, Gamepad2, LogOut, Menu, X } from "lucide-react";
import banner from "@/common/assets/banner.png";

export const Navigation = () => {
    const { logout } = useContext(AuthContext);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { to: "/games", icon: Gamepad2, label: "Games" },
        { to: "/settings", icon: Settings, label: "Settings" },
    ];

    return (
        <nav className="w-full bg-[#0a0a0a] border-b border-primary/50">
            <div className="flex items-center px-4 md:px-8 py-4">
                <div className="py-2 flex-shrink-0">
                    <img
                        src={banner}
                        alt="Arcader"
                        className="h-8 md:h-10 w-auto"
                    />
                </div>

                <div className="hidden md:flex items-center gap-4 flex-1 justify-center">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-2 px-4 py-2 font-head text-sm font-normal transition-all duration-200 bg-secondary border-2 border-border",
                                    isActive 
                                        ? "text-primary-foreground bg-primary shadow-md translate-y-0" 
                                        : "text-foreground hover:translate-y-1 shadow-sm hover:shadow-none active:translate-y-1",
                                )
                            }
                        >
                            <>
                                <item.icon className="w-4 h-4" />
                                <span className="uppercase tracking-wider">
                                    {item.label}
                                </span>
                            </>
                        </NavLink>
                    ))}
                </div>

                <Button
                    variant="secondary"
                    size="sm"
                    className="hidden md:flex gap-2 uppercase font-bold flex-shrink-0 ml-auto"
                    onClick={logout}
                >
                    <LogOut className="w-4 h-4" />
                    LOGOUT
                </Button>

                <button
                    className="md:hidden p-2 text-foreground/70 hover:text-primary transition-all"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    {isMobileMenuOpen ? (
                        <X className="w-6 h-6" />
                    ) : (
                        <Menu className="w-6 h-6" />
                    )}
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="md:hidden border-t-2 border-border bg-[#0a0a0a] px-4 py-4 space-y-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 px-4 py-3 font-head text-base font-normal transition-all duration-200 w-full uppercase tracking-wider bg-secondary border-2 border-border",
                                    isActive 
                                        ? "text-primary-foreground bg-primary shadow-md" 
                                        : "text-foreground active:translate-y-1 shadow-sm active:shadow-none",
                                )
                            }
                        >
                            <>
                                <item.icon className="w-5 h-5" />
                                <span>{item.label}</span>
                            </>
                        </NavLink>
                    ))}
                    <div className="pt-2 mt-2 border-t-2 border-border">
                        <Button
                            variant="secondary"
                            size="md"
                            className="w-full gap-2 uppercase font-bold"
                            onClick={logout}
                        >
                            <LogOut className="w-5 h-5" />
                            LOGOUT
                        </Button>
                    </div>
                </div>
            )}
        </nav>
    );
};
