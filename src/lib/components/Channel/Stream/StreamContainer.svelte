<script lang="ts">
	import IconViewers from '$lib/assets/icons/IconViewers.svelte'
	import StreamControls from '$lib/components/Channel/Stream/StreamControls.svelte'
	// import DropdownViewers from '$lib/components/Channel/Stream/DropdownViewers.svelte'
	import VideoGrid from '$lib/components/Channel/Stream/VideoGrid.svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { createEventDispatcher } from 'svelte'
	import { video_items } from '$lib/stores/streamStore'
	import { channel_connection } from '$lib/stores/websocketStore'

	const dispatch = createEventDispatcher()
	export let userCount: number = 1,
		channel: any,
		channels: any = [],
		isHostOrGuest: boolean = false

	$: isChannelSocketConnected = $channel_connection === 'open'

	function autoActive(node: Element) {
		const observer = new IntersectionObserver(callback, { threshold: 0.5 })
		observer.observe(node)

		function callback(entries: IntersectionObserverEntry[]) {
			const entry = entries.find((entry) => entry.isIntersecting)
			if (entry) {
				const id = entry.target.id
				channel = channels?.filter((channel: any) => channel?._id === id)[0]
				if (channels?.length && channels[channels.length - 2]?._id == id) {
					dispatch('loadMore')
				}

				goto(`${id}`, {
					keepFocus: true,
					replaceState: true,
					noScroll: true
				})
			}
		}

		return { destroy: () => observer.disconnect() }
	}
</script>

<div class="flex justify-center h-full">
	<div class="carousel carousel-vertical rounded-lg bg-base-100 w-full m-5 mb-24">
		{#each channels as nextchannel}
			<div class="carousel-item h-full p-3" id={nextchannel?._id} use:autoActive>
				<div class="flex flex-col w-full">
					<div class="flex gap-2 mb-3">
						<span
							class="btn btn-sm rounded-md font-medium text-white border-none flex items-center {$video_items?.length
								? 'bg-red-700 hover:bg-red-700'
								: ''}">
							LIVE
						</span>
						<div class="dropdown dropdown-bottom">
							<label
								for=""
								class="btn btn-sm rounded-md font-medium gap-2 text-white border-none"
								tabindex="-1">
								<IconViewers />
								{userCount}
							</label>
							<!-- <DropdownViewers /> -->
						</div>
					</div>
					{#if channel && nextchannel?._id === $page.params.channelId}
						<VideoGrid {channel} />
						{#if !$video_items?.length && isChannelSocketConnected}
							<div
								class="mockup-code absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all">
								<pre data-prefix="$"><code>npm check streams</code></pre>
								<pre data-prefix=">" class="text-warning"><code>pinging host...</code></pre>
								<pre data-prefix=">" class="text-success"><code
										>Streams not found for this channel</code></pre>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<div class="absolute bottom-0 m-5">
		<StreamControls {isHostOrGuest} />
	</div>
</div>
