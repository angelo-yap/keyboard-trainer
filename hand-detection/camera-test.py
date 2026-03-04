from pygrabber.dshow_graph import FilterGraph

graph = FilterGraph()
devices = graph.get_input_devices()

for i, name in enumerate(devices):
    print(f"Index {i}: {name}")