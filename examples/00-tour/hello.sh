#!/usr/bin/env bash
# Greets someone (the world by default) in big letters, said by a cow.
name="${1:-world}"
figlet "${GREETING:-Hello}, $name!" | cowsay -n
