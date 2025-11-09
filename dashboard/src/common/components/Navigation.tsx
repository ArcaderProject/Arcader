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
            <div className="flex items-center justify-between px-4 md:px-8 py-4">
                <div className="py-2">
                    <img
                        src={banner}
                        alt="Arcader"
                        className="h-8 md:h-10 w-auto"
                    />
                </div>

                <div className="hidden md:flex items-center gap-4">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-2 px-6 py-2 font-head text-sm font-normal transition-all border border-transparent text-foreground/70 hover:text-primary hover:border-primary/30",
                                    isActive && "text-primary border-primary",
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
                    className="hidden md:flex gap-2 uppercase font-bold"
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
                <div className="md:hidden border-t border-primary/30 bg-[#0a0a0a] px-4 py-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 px-4 py-3 font-head text-base font-normal transition-all text-foreground/70 hover:text-primary hover:bg-primary/5 w-full uppercase tracking-wider",
                                    isActive && "text-primary bg-primary/10",
                                )
                            }
                        >
                            <>
                                <item.icon className="w-5 h-5" />
                                <span>{item.label}</span>
                            </>
                        </NavLink>
                    ))}
                    <Button
                        variant="secondary"
                        size="md"
                        className="w-full gap-2 uppercase font-bold mt-4 border-t border-primary/30 pt-4"
                        onClick={logout}
                    >
                        <LogOut className="w-5 h-5" />
                        LOGOUT
                    </Button>
                </div>
            )}
        </nav>
    );
};
