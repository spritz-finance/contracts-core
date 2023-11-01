sudo apt install build-essential -y; curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y; source "$HOME/.cargo/env"; git clone https://github.com/0age/create2crunch && cd create2crunch; sed -i 's/0x4/0x40/g' src/lib.rs

sudo apt update
sudo apt install ocl-icd-opencl-dev

export FACTORY="0x0a9190fb699b6ec18fea4dc2791548aa24e12f36"; export CALLER="0x0f0f7b0a7287aea91d5f1b3125951dbb3d4f692e"; export INIT_CODE_HASH="0x83062432340938565e6d79828412b48adf319157b1ffb459d9e50d83943724b6"; export LEADING=5; export TOTAL=7; cargo run --release $FACTORY $CALLER $INIT_CODE_HASH 0 $LEADING $TOTAL
